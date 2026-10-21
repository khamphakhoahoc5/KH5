/* Lớp cài đặt PWA; không thay đổi dữ liệu hoặc nội dung bài học. */
(() => {
  'use strict';
  const script = document.currentScript;
  const base = new URL('./', script ? script.src : location.href);
  let installPrompt = null;
  let registration = null;
  let reloadForUpdate = false;
  let reloaded = false;
  let noticeTimer;
  let offlineReady = false;
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const supported = 'serviceWorker' in navigator && window.isSecureContext && /^https?:$/.test(location.protocol);

  const opener = document.createElement('button');
  opener.type = 'button';
  opener.id = 'kh5-pwa-open';
  opener.className = 'top-button';
  opener.setAttribute('aria-haspopup', 'dialog');
  opener.setAttribute('aria-controls', 'kh5-pwa-dialog');
  opener.textContent = standalone() ? 'Ứng dụng' : 'Cài ứng dụng';
  const target = document.querySelector('.top-actions');
  if (!target) return;
  target.append(opener);

  const dialog = document.createElement('dialog');
  dialog.id = 'kh5-pwa-dialog';
  dialog.setAttribute('aria-labelledby', 'kh5-pwa-title');
  dialog.innerHTML = `
    <div class="pwa-heading"><img width="64" height="64" alt=""><h2 id="kh5-pwa-title">Khám phá Khoa học 5</h2></div>
    <p>Cài học liệu lên màn hình chính để mở nhanh như một ứng dụng.</p>
    <div id="kh5-pwa-help">
      <p><strong>Android hoặc máy tính:</strong> dùng nút cài đặt khi trình duyệt hiển thị, hoặc mở menu trình duyệt và chọn cài ứng dụng.</p>
      <p><strong>iPhone hoặc iPad:</strong> mở website bằng Safari, chọn Chia sẻ rồi chọn Thêm vào Màn hình chính.</p>
    </div>
    <p id="kh5-pwa-status" class="pwa-status" role="status" aria-live="polite">Đang kiểm tra khả năng dùng ngoại tuyến…</p>
    <p>Ghi chú và tiến độ được lưu trên trình duyệt, thiết bị đang dùng. Dữ liệu không tự đồng bộ sang thiết bị khác.</p>
    <section id="kh5-pwa-update" class="pwa-update" hidden>
      <p><strong>Đã có bản cập nhật.</strong> Hãy lưu ghi chú trước khi cập nhật. Trang sẽ tải lại khi thầy cô hoặc học sinh chọn cập nhật ngay.</p>
      <button id="kh5-pwa-update-now" type="button">Cập nhật ngay</button>
    </section>
    <div class="pwa-actions"><button id="kh5-pwa-close" type="button">Đóng</button><button id="kh5-pwa-install-now" class="pwa-primary" type="button" hidden>Cài ứng dụng</button></div>`;
  dialog.querySelector('img').src = new URL('icons/icon-192.png', base).href;
  document.body.append(dialog);
  const status = dialog.querySelector('#kh5-pwa-status');
  const installButton = dialog.querySelector('#kh5-pwa-install-now');
  const updateSection = dialog.querySelector('#kh5-pwa-update');
  const updateButton = dialog.querySelector('#kh5-pwa-update-now');

  const notice = document.createElement('aside');
  notice.id = 'kh5-pwa-notice';
  notice.hidden = true;
  notice.innerHTML = '<p role="status" aria-live="polite"></p><button type="button" aria-label="Đóng thông báo">Đóng</button>';
  document.body.append(notice);
  notice.querySelector('button').addEventListener('click', () => {notice.hidden = true; clearTimeout(noticeTimer);});
  function announce(message) {
    notice.querySelector('p').textContent = message;
    notice.hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {notice.hidden = true;}, 8500);
  }
  function closeDialog() {
    if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
    opener.focus({preventScroll:true});
  }
  dialog.querySelector('#kh5-pwa-close').addEventListener('click', closeDialog);
  dialog.addEventListener('cancel', () => requestAnimationFrame(() => opener.focus({preventScroll:true})));
  opener.addEventListener('click', () => {
    installButton.hidden = !installPrompt || standalone();
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    refreshStatus();
  });

  function queryOffline(worker) {
    return new Promise(resolve => {
      if (!worker) return resolve(false);
      const channel = new MessageChannel();
      const timer = setTimeout(() => {channel.port1.close(); resolve(false);}, 6000);
      channel.port1.onmessage = event => {
        clearTimeout(timer); channel.port1.close(); resolve(event.data && event.data.ready === true);
      };
      worker.postMessage({type:'KH5_OFFLINE_STATUS'}, [channel.port2]);
    });
  }
  async function refreshStatus() {
    if (!supported) {
      status.textContent = location.protocol === 'file:' || !window.isSecureContext
        ? 'Để cài ứng dụng và lưu học liệu ngoại tuyến, hãy mở website bằng đường dẫn HTTPS. Bản đang mở trực tiếp vẫn dùng được các bài học.'
        : 'Trình duyệt này chưa hỗ trợ lưu học liệu ngoại tuyến. Thầy cô hoặc học sinh vẫn có thể học trực tiếp trên website.';
      return;
    }
    if (!registration || !registration.active) {
      status.textContent = navigator.onLine ? 'Đang tải học liệu để dùng ngoại tuyến. Hãy giữ trang mở trong lần truy cập đầu tiên.' : 'Chưa xác nhận được bản lưu ngoại tuyến. Hãy kết nối mạng và mở lại website.';
      return;
    }
    offlineReady = await queryOffline(registration.active);
    status.textContent = offlineReady
      ? (navigator.onLine ? 'Sẵn sàng dùng ngoại tuyến. Các bài học đã được lưu trên thiết bị này.' : 'Đang ngoại tuyến. Các bài học đã lưu vẫn dùng được.')
      : 'Chưa lưu đủ học liệu ngoại tuyến. Hãy kết nối mạng và tải lại trang; kiểm tra dung lượng thiết bị nếu cần.';
    if (registration.waiting) updateSection.hidden = false;
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); installPrompt = event; installButton.hidden = standalone();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null; installButton.hidden = true; opener.textContent = 'Ứng dụng';
    announce('Đã cài Khám phá Khoa học 5.');
  });
  installButton.addEventListener('click', async () => {
    if (!installPrompt) return;
    const prompt = installPrompt; installPrompt = null;
    installButton.disabled = true;
    try {await prompt.prompt(); await prompt.userChoice;}
    catch {announce('Có thể mở menu trình duyệt để cài ứng dụng.');}
    finally {installButton.disabled = false; installButton.hidden = true;}
  });
  updateButton.addEventListener('click', () => {
    if (!registration || !registration.waiting) return;
    reloadForUpdate = true; updateButton.disabled = true;
    updateButton.textContent = 'Đang cập nhật…';
    registration.waiting.postMessage({type:'KH5_ACTIVATE_UPDATE'});
  });
  window.addEventListener('online', refreshStatus);
  window.addEventListener('offline', refreshStatus);
  if (!supported) {refreshStatus(); return;}

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadForUpdate && !reloaded) {reloaded = true; location.reload(); return;}
    refreshStatus();
  });
  function reportUpdate() {
    updateSection.hidden = false;
    announce('Đã có bản mới. Mở mục Ứng dụng hoặc Cài ứng dụng để cập nhật khi thuận tiện.');
  }
  navigator.serviceWorker.register(new URL('sw.js', base), {scope:base.href,updateViaCache:'none'})
    .then(async reg => {
      registration = reg;
      if (reg.waiting) reportUpdate();
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) reportUpdate();
          if (worker.state === 'activated') refreshStatus();
          if (worker.state === 'redundant' && !reg.active) status.textContent = 'Chưa tải xong bản dùng ngoại tuyến. Hãy giữ kết nối mạng và thử tải lại trang.';
        });
      });
      await navigator.serviceWorker.ready;
      await refreshStatus();
      if (offlineReady) {
        const key = 'kh5-pwa-ready:' + base.pathname;
        let shown = false;
        try {shown = sessionStorage.getItem(key) === '1'; sessionStorage.setItem(key,'1');} catch {}
        if (!shown) announce('Đã lưu học liệu. Có thể tiếp tục học khi không có mạng.');
      }
    })
    .catch(() => {status.textContent = 'Chưa thiết lập được bản dùng ngoại tuyến. Hãy kiểm tra kết nối mạng rồi tải lại trang. Website vẫn mở được khi có mạng.';});
})();
