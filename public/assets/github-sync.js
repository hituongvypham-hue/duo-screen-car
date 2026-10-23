(function () {
  const GITHUB_TOKEN = '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';
  const GITHUB_REPO = 'hituongvypham-hue/duo-screen-car';
  const GITHUB_FILE = 'playlists.json';

  let currentSha = null;
  let syncTimer = null;
  let isInternalUpdate = false;

  // 1. Fetch playlists from GitHub on startup
  async function loadFromGithub() {
    try {
      console.log('☁️ [DuoScreen Sync] Đang kết nối GitHub để đồng bộ playlist...');
      const res = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + GITHUB_FILE + '?t=' + Date.now(), {
        headers: {
          'Authorization': 'token ' + GITHUB_TOKEN,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      const data = await res.json();
      if (data && data.sha && data.content) {
        currentSha = data.sha;
        const binary = atob(data.content.replace(/\s/g, ''));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const text = new TextDecoder('utf-8').decode(bytes);
        const parsed = JSON.parse(text);

        if (Array.isArray(parsed) && parsed.length > 0) {
          isInternalUpdate = true;
          localStorage.setItem('douscreen_playlists', JSON.stringify(parsed));
          isInternalUpdate = false;
          window.dispatchEvent(new Event('storage'));
          console.log('✅ ☁️ [DuoScreen Sync] Đã đồng bộ ' + parsed.length + ' danh sách phát từ GitHub thành công!');
        }
      }
    } catch (err) {
      console.warn('⚠️ ☁️ [DuoScreen Sync] Lỗi kết nối GitHub:', err);
    }
  }

  // 2. Save playlists to GitHub (debounced 1s)
  function saveToGithub(playlists) {
    if (isInternalUpdate) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
      try {
        console.log('☁️ [DuoScreen Sync] Đang lưu thay đổi lên GitHub...');
        if (!currentSha) {
          const checkRes = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + GITHUB_FILE + '?t=' + Date.now(), {
            headers: {
              'Authorization': 'token ' + GITHUB_TOKEN,
              'Accept': 'application/vnd.github.v3+json'
            }
          });
          const checkData = await checkRes.json();
          if (checkData && checkData.sha) currentSha = checkData.sha;
        }

        const jsonStr = JSON.stringify(playlists, null, 2);
        const utf8Bytes = new TextEncoder().encode(jsonStr);
        let binaryStr = '';
        for (let i = 0; i < utf8Bytes.length; i++) binaryStr += String.fromCharCode(utf8Bytes[i]);
        const contentBase64 = btoa(binaryStr);

        const putRes = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + GITHUB_FILE, {
          method: 'PUT',
          headers: {
            'Authorization': 'token ' + GITHUB_TOKEN,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: 'Sync playlists from DuoScreen [skip ci]',
            content: contentBase64,
            sha: currentSha
          })
        });

        const resJson = await putRes.json();
        if (resJson && resJson.content && resJson.content.sha) {
          currentSha = resJson.content.sha;
          console.log('🎉 ☁️ [DuoScreen Sync] Đã lưu playlist lên GitHub thành công!');
        }
      } catch (err) {
        console.error('❌ ☁️ [DuoScreen Sync] Lỗi khi lưu lên GitHub:', err);
      }
    }, 1000);
  }

  // 3. Hook into Storage.prototype.setItem
  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    originalSetItem.apply(this, arguments);
    if (key === 'douscreen_playlists') {
      try {
        const playlists = JSON.parse(value);
        saveToGithub(playlists);
      } catch (e) {}
    }
  };

  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadFromGithub);
  } else {
    loadFromGithub();
  }
})();
