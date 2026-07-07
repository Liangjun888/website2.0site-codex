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
    config: document.querySelector("[data-config-view]"),
    auth: document.querySelector("[data-auth-view]"),
    client: document.querySelector("[data-client-view]"),
  };
  var statusEl = document.querySelector("[data-portal-status]");
  var reportList = document.querySelector("[data-report-list]");
  var userEmail = document.querySelector("[data-user-email]");
  var adminLink = document.querySelector("[data-admin-link]");

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

  function formatBytes(bytes) {
    if (!bytes) return "";
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  }

  function mapFiles(files) {
    return (files || []).reduce(function (memo, file) {
      memo[file.language_code] = file;
      return memo;
    }, {});
  }

  function renderReports(reports) {
    if (!reportList) return;
    if (!reports || !reports.length) {
      reportList.innerHTML = '<div class="portal-empty">目前暂无已发布月报。</div>';
      return;
    }

    reportList.innerHTML = reports
      .map(function (report) {
        var files = mapFiles(report.monthly_report_files);
        var buttons = LANGUAGE_ORDER.map(function (languageCode) {
          var file = files[languageCode];
          if (!file) {
            return '<button class="portal-download" type="button" disabled>' + LANGUAGE_LABELS[languageCode] + "</button>";
          }
          return (
            '<button class="portal-download" type="button" data-report-file-id="' +
            escapeHtml(file.id) +
            '" data-storage-path="' +
            escapeHtml(file.storage_path) +
            '">' +
            LANGUAGE_LABELS[languageCode] +
            (file.file_size ? " · " + formatBytes(file.file_size) : "") +
            "</button>"
          );
        }).join("");

        return (
          '<article class="report-card">' +
          '<div class="report-card__meta">' +
          '<span>' +
          escapeHtml(formatMonth(report.report_month)) +
          "</span>" +
          '<span>已发布</span>' +
          "</div>" +
          "<h3>" +
          escapeHtml(report.title) +
          "</h3>" +
          "<p>" +
          escapeHtml(report.summary) +
          "</p>" +
          '<div class="report-card__actions">' +
          buttons +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  async function loadProfile() {
    var result = await supabaseClient.from("profiles").select("role, display_name").eq("id", session.user.id).maybeSingle();
    if (result.error) throw result.error;
    profile = result.data || { role: "client" };
    if (adminLink && profile.role === "admin") adminLink.hidden = false;
  }

  async function loadReports() {
    if (!reportList) return;
    reportList.innerHTML = '<div class="portal-loading">正在读取资料库...</div>';
    var result = await supabaseClient
      .from("monthly_reports")
      .select("id, report_month, title, summary, status, published_at, monthly_report_files(id, language_code, storage_path, file_name, file_size)")
      .eq("status", "published")
      .order("report_month", { ascending: false });

    if (result.error) throw result.error;
    renderReports(result.data || []);
  }

  async function refreshSession() {
    var authResult = await supabaseClient.auth.getSession();
    session = authResult.data.session;
    if (!session) {
      showView("auth");
      return;
    }
    showView("client");
    if (userEmail) userEmail.textContent = "当前登录邮箱：" + session.user.email;
    await loadProfile();
    await loadReports();
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

  async function downloadFile(button) {
    var path = button.getAttribute("data-storage-path");
    var reportFileId = button.getAttribute("data-report-file-id");
    if (!path || !reportFileId) return;

    button.disabled = true;
    button.textContent = "准备下载...";
    try {
      var signed = await supabaseClient.storage.from(bucket).createSignedUrl(path, 60);
      if (signed.error) throw signed.error;

      await supabaseClient.from("download_events").insert({
        user_id: session.user.id,
        report_file_id: reportFileId,
      });

      window.location.href = signed.data.signedUrl;
    } catch (error) {
      setStatus(error.message || "下载失败，请稍后重试。", "error");
    } finally {
      button.disabled = false;
      loadReports().catch(function () {});
    }
  }

  function bindEvents() {
    var loginForm = document.querySelector("[data-login-form]");
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

    var signOut = document.querySelector("[data-sign-out]");
    if (signOut) {
      signOut.addEventListener("click", function () {
        supabaseClient.auth.signOut().then(function () {
          session = null;
          profile = null;
          setStatus("已退出登录。", "neutral");
          showView("auth");
        });
      });
    }

    var refresh = document.querySelector("[data-refresh-reports]");
    if (refresh) {
      refresh.addEventListener("click", function () {
        loadReports().catch(function (error) {
          setStatus(error.message || "刷新失败。", "error");
        });
      });
    }

    if (reportList) {
      reportList.addEventListener("click", function (event) {
        var button = event.target.closest("[data-storage-path]");
        if (button) downloadFile(button);
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
      setStatus(error.message || "客户资料库暂时无法读取。", "error");
      showView("auth");
    }
  }

  init();
})();
