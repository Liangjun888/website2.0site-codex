(function () {
  var LANGUAGE_ORDER = ["zh-CN", "zh-HK", "en"];
  var LANGUAGE_LABELS = {
    "zh-CN": "简体中文",
    "zh-HK": "繁體中文",
    en: "English",
  };

  var config = window.GSC_PORTAL_CONFIG || {};
  var bucket = config.storageBucket || "client-documents";
  var supabaseClient = null;
  var session = null;
  var profile = null;

  var views = {
    config: document.querySelector("[data-admin-config-view]"),
    login: document.querySelector("[data-admin-login-view]"),
    console: document.querySelector("[data-admin-console]"),
  };
  var statusEl = document.querySelector("[data-admin-status]");
  var reportList = document.querySelector("[data-admin-report-list]");
  var userEmail = document.querySelector("[data-admin-user-email]");

  function hasConfig() {
    return Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase);
  }

  function showView(name) {
    Object.keys(views).forEach(function (key) {
      if (views[key]) views[key].hidden = key !== name;
    });
  }

  function setStatus(message, tone) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.dataset.tone = tone || "neutral";
    statusEl.hidden = !message;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatMonth(value) {
    if (!value) return "";
    var parts = value.split("-");
    if (parts.length < 2) return value;
    return parts[0] + "年" + Number(parts[1]) + "月";
  }

  function slugFileName(fileName) {
    return String(fileName || "report.pdf")
      .toLowerCase()
      .replace(/[^a-z0-9.\-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function mapFiles(files) {
    return (files || []).reduce(function (memo, file) {
      memo[file.language_code] = file;
      return memo;
    }, {});
  }

  function renderAdminReports(reports) {
    if (!reportList) return;
    if (!reports || !reports.length) {
      reportList.innerHTML = '<div class="portal-empty">目前暂无月报。</div>';
      return;
    }

    reportList.innerHTML = reports
      .map(function (report) {
        var files = mapFiles(report.monthly_report_files);
        var badges = LANGUAGE_ORDER.map(function (languageCode) {
          var ready = Boolean(files[languageCode]);
          return '<span class="language-badge' + (ready ? " ready" : "") + '">' + LANGUAGE_LABELS[languageCode] + "</span>";
        }).join("");
        return (
          '<article class="report-card">' +
          '<div class="report-card__meta">' +
          '<span>' +
          escapeHtml(formatMonth(report.report_month)) +
          "</span>" +
          "<span>" +
          (report.status === "published" ? "已发布" : "草稿") +
          "</span>" +
          "</div>" +
          "<h3>" +
          escapeHtml(report.title) +
          "</h3>" +
          "<p>" +
          escapeHtml(report.summary) +
          "</p>" +
          '<div class="language-row">' +
          badges +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  async function loadProfile() {
    var result = await supabaseClient.from("profiles").select("role, display_name").eq("id", session.user.id).maybeSingle();
    if (result.error) throw result.error;
    profile = result.data;
    if (!profile || profile.role !== "admin") {
      showView("login");
      throw new Error("当前账号没有后台权限。请确认 profiles 表中的角色为 admin。");
    }
  }

  async function loadReports() {
    if (!reportList) return;
    reportList.innerHTML = '<div class="portal-loading">正在读取资料...</div>';
    var result = await supabaseClient
      .from("monthly_reports")
      .select("id, report_month, title, summary, status, published_at, monthly_report_files(id, language_code, storage_path, file_name, file_size)")
      .order("report_month", { ascending: false });
    if (result.error) throw result.error;
    renderAdminReports(result.data || []);
  }

  async function sendMagicLink(email) {
    var redirectTo = window.location.origin + window.location.pathname;
    var result = await supabaseClient.auth.signInWithOtp({
      email: email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: redirectTo,
      },
    });
    if (result.error) throw result.error;
    setStatus("登录链接已发送，请查看邮箱。", "success");
  }

  async function refreshSession() {
    var authResult = await supabaseClient.auth.getSession();
    session = authResult.data.session;
    if (!session) {
      showView("login");
      return;
    }
    if (userEmail) userEmail.textContent = "当前管理员邮箱：" + session.user.email;
    await loadProfile();
    showView("console");
    await loadReports();
  }

  async function uploadLanguageFile(reportId, monthValue, languageCode, file) {
    if (!file) throw new Error("缺少 " + LANGUAGE_LABELS[languageCode] + " 文件。");
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      throw new Error(LANGUAGE_LABELS[languageCode] + " 文件必须为 PDF。");
    }

    var storagePath = "monthly-reports/" + monthValue + "/" + languageCode + "-" + slugFileName(file.name);
    var upload = await supabaseClient.storage.from(bucket).upload(storagePath, file, {
      cacheControl: "3600",
      contentType: "application/pdf",
      upsert: true,
    });
    if (upload.error) throw upload.error;

    var fileRow = {
      report_id: reportId,
      language_code: languageCode,
      storage_path: storagePath,
      file_name: file.name,
      file_size: file.size,
      uploaded_by: session.user.id,
    };
    var upsert = await supabaseClient
      .from("monthly_report_files")
      .upsert(fileRow, { onConflict: "report_id,language_code" })
      .select("id")
      .single();
    if (upsert.error) throw upsert.error;
  }

  async function handleReportSubmit(form) {
    var formData = new FormData(form);
    var monthValue = formData.get("reportMonth");
    var title = formData.get("title");
    var summary = formData.get("summary");
    var publishNow = Boolean(formData.get("publishNow"));
    var reportDate = monthValue + "-01";

    setStatus("正在创建月报记录...", "neutral");
    var reportResult = await supabaseClient
      .from("monthly_reports")
      .upsert(
        {
          report_month: reportDate,
          title: title,
          summary: summary,
          status: "draft",
          created_by: session.user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "report_month" },
      )
      .select("id")
      .single();
    if (reportResult.error) throw reportResult.error;

    var reportId = reportResult.data.id;
    for (var i = 0; i < LANGUAGE_ORDER.length; i += 1) {
      var languageCode = LANGUAGE_ORDER[i];
      var file = formData.get(languageCode);
      setStatus("正在上传 " + LANGUAGE_LABELS[languageCode] + "...", "neutral");
      await uploadLanguageFile(reportId, monthValue, languageCode, file);
    }

    if (publishNow) {
      setStatus("正在发布月报...", "neutral");
      var publish = await supabaseClient
        .from("monthly_reports")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", reportId);
      if (publish.error) throw publish.error;
    }

    form.reset();
    setStatus(publishNow ? "月报已上传并发布。" : "月报已保存为草稿。", "success");
    await loadReports();
  }

  function bindEvents() {
    var loginForm = document.querySelector("[data-admin-login-form]");
    if (loginForm) {
      loginForm.addEventListener("submit", function (event) {
        event.preventDefault();
        var email = new FormData(loginForm).get("email");
        setStatus("正在发送登录链接...", "neutral");
        sendMagicLink(email).catch(function (error) {
          setStatus(error.message || "发送失败，请确认邮箱后重试。", "error");
        });
      });
    }

    var reportForm = document.querySelector("[data-report-form]");
    if (reportForm) {
      reportForm.addEventListener("submit", function (event) {
        event.preventDefault();
        handleReportSubmit(reportForm).catch(function (error) {
          setStatus(error.message || "上传失败，请检查文件和权限。", "error");
        });
      });
    }

    var refresh = document.querySelector("[data-admin-refresh]");
    if (refresh) {
      refresh.addEventListener("click", function () {
        loadReports().catch(function (error) {
          setStatus(error.message || "刷新失败。", "error");
        });
      });
    }

    var signOut = document.querySelector("[data-admin-sign-out]");
    if (signOut) {
      signOut.addEventListener("click", function () {
        supabaseClient.auth.signOut().then(function () {
          session = null;
          profile = null;
          setStatus("已退出登录。", "neutral");
          showView("login");
        });
      });
    }
  }

  async function init() {
    if (!hasConfig()) {
      showView("config");
      return;
    }
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    bindEvents();
    supabaseClient.auth.onAuthStateChange(function (_event, newSession) {
      session = newSession;
      refreshSession().catch(function (error) {
        setStatus(error.message || "读取登录状态失败。", "error");
      });
    });
    try {
      await refreshSession();
    } catch (error) {
      setStatus(error.message || "后台暂时无法读取。", "error");
    }
  }

  init();
})();
