(function () {
  const GITHUB_TOKEN = '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';
  const GITHUB_REPO = 'hituongvypham-hue/duo-screen-car';
  const GITHUB_FILE = 'users_data.json';

  let currentSha = null;
  let syncTimer = null;
  let isInternalUpdate = false;
  let allUsersData = { users: [] };

  // Encode / Decode UTF-8 Base64
  function toBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function fromBase64(b64) {
    const bin = atob(b64.replace(/\s/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }

  // 1. Fetch all users from GitHub
  async function fetchUsersFromGithub() {
    try {
      const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}?t=${Date.now()}`, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      const data = await res.json();
      if (data && data.sha && data.content) {
        currentSha = data.sha;
        const text = fromBase64(data.content);
        const parsed = JSON.parse(text);
        if (parsed && Array.isArray(parsed.users)) {
          allUsersData = parsed;
          window.duoscreenUsers = parsed.users;
          return parsed.users;
        }
      }
    } catch (err) {
      console.warn('☁️ [DuoScreen Sync] Lỗi tải users_data từ GitHub:', err);
    }
    return null;
  }

  // 2. Save all users data to GitHub
  function saveUsersToGithub() {
    if (isInternalUpdate) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
      try {
        console.log('☁️ [DuoScreen Sync] Đang lưu dữ liệu người dùng lên GitHub...');
        if (!currentSha) {
          const checkRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}?t=${Date.now()}`, {
            headers: {
              'Authorization': `token ${GITHUB_TOKEN}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          });
          const checkData = await checkRes.json();
          if (checkData && checkData.sha) currentSha = checkData.sha;
        }

        const jsonStr = JSON.stringify(allUsersData, null, 2);
        const contentBase64 = toBase64(jsonStr);

        const putRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`, {
          method: 'PUT',
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: 'Sync users and playlists from DuoScreen [skip ci]',
            content: contentBase64,
            sha: currentSha
          })
        });

        const resJson = await putRes.json();
        if (resJson && resJson.content && resJson.content.sha) {
          currentSha = resJson.content.sha;
          console.log('🎉 ☁️ [DuoScreen Sync] Đã lưu lên GitHub thành công!');
        }
      } catch (err) {
        console.error('❌ ☁️ [DuoScreen Sync] Lỗi lưu lên GitHub:', err);
      }
    }, 1000);
  }

  // 3. Switch active user profile
  function switchActiveUser(user) {
    if (!user) return;
    isInternalUpdate = true;

    localStorage.setItem('douscreen_active_user_id', user.id);
    localStorage.setItem('douscreen_driver_profile', JSON.stringify({
      name: user.name,
      avatar: user.avatar || '🚗'
    }));
    localStorage.setItem('douscreen_playlists', JSON.stringify(user.playlists || []));

    isInternalUpdate = false;
    window.dispatchEvent(new Event('storage'));

    console.log(`✅ [DuoScreen] Đang sử dụng hồ sơ: ${user.name} (${user.avatar})`);
  }

  // 4. Create new user
  function createNewUser(name, avatar) {
    const trimmed = (name || '').trim() || 'Tài xế';
    const newUser = {
      id: 'u_' + Date.now(),
      name: trimmed,
      avatar: avatar || '🚗',
      createdAt: Date.now(),
      playlists: [
        {
          id: 'favorites',
          name: 'Bài hát yêu thích ❤️',
          createdAt: Date.now(),
          videos: []
        },
        {
          id: 'night_drive',
          name: 'Nhạc lái xe đêm 🌙',
          createdAt: Date.now(),
          videos: []
        }
      ]
    };

    allUsersData.users = [newUser, ...(allUsersData.users || [])];
    window.duoscreenUsers = allUsersData.users;
    switchActiveUser(newUser);
    saveUsersToGithub();
    return newUser;
  }

  // 5. Hook into Storage.prototype.setItem
  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    originalSetItem.apply(this, arguments);

    if (isInternalUpdate) return;

    const activeUserId = localStorage.getItem('douscreen_active_user_id');

    // If playlists updated
    if (key === 'douscreen_playlists') {
      try {
        const playlists = JSON.parse(value);
        if (activeUserId && Array.isArray(allUsersData.users)) {
          const user = allUsersData.users.find(u => u.id === activeUserId);
          if (user) {
            user.playlists = playlists;
            saveUsersToGithub();
          }
        }
      } catch (e) {}
    }

    // If driver profile updated
    if (key === 'douscreen_driver_profile') {
      try {
        const profile = JSON.parse(value);
        if (activeUserId && Array.isArray(allUsersData.users)) {
          const user = allUsersData.users.find(u => u.id === activeUserId);
          if (user && profile) {
            user.name = profile.name || user.name;
            user.avatar = profile.avatar || user.avatar;
            saveUsersToGithub();
          }
        }
      } catch (e) {}
    }
  };

  // 6. Expose Global Multi-User API for the "Hồ sơ tài xế" modal
  window.duoscreenUsers = [];
  window.getDuoScreenUsers = function () {
    return allUsersData.users || [];
  };
  window.switchDuoScreenUser = function (user) {
    switchActiveUser(user);
  };
  window.createDuoScreenUser = function (name, avatar) {
    return createNewUser(name, avatar);
  };

  // Remove any legacy floating switch button if present
  const oldBtn = document.getElementById('btn-switch-profile');
  if (oldBtn) oldBtn.remove();
  const oldModal = document.getElementById('duoscreen-user-modal');
  if (oldModal) oldModal.remove();

  // 7. Main Initialization
  async function init() {
    console.log('☁️ [DuoScreen Sync] Khởi động hệ thống Multi-User Profiles...');

    const users = await fetchUsersFromGithub();
    const activeUserId = localStorage.getItem('douscreen_active_user_id');

    if (users && users.length > 0) {
      allUsersData.users = users;
      window.duoscreenUsers = users;

      if (!activeUserId) {
        // Tự động sử dụng user đầu tiên nếu là lần đầu
        switchActiveUser(users[0]);
      } else {
        // Đồng bộ dữ liệu mới nhất của user đang chọn
        const activeUser = users.find(u => u.id === activeUserId);
        if (activeUser) {
          isInternalUpdate = true;
          localStorage.setItem('douscreen_playlists', JSON.stringify(activeUser.playlists || []));
          localStorage.setItem('douscreen_driver_profile', JSON.stringify({
            name: activeUser.name,
            avatar: activeUser.avatar || '🚗'
          }));
          isInternalUpdate = false;
          window.dispatchEvent(new Event('storage'));
          console.log(`☁️ [DuoScreen Sync] Đã đồng bộ dữ liệu cho: ${activeUser.name}`);
        } else {
          switchActiveUser(users[0]);
        }
      }
    } else {
      // Nếu GitHub chưa có user nào
      const initialUser = {
        id: 'u_default',
        name: 'Tài xế Vy',
        avatar: '🚗',
        createdAt: Date.now(),
        playlists: [
          {
            id: 'favorites',
            name: 'Bài hát yêu thích ❤️',
            createdAt: Date.now(),
            videos: []
          },
          {
            id: 'night_drive',
            name: 'Nhạc lái xe đêm 🌙',
            createdAt: Date.now(),
            videos: []
          }
        ]
      };
      allUsersData = { users: [initialUser] };
      window.duoscreenUsers = [initialUser];
      if (!activeUserId) {
        switchActiveUser(initialUser);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
