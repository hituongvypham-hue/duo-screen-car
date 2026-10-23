(function () {
  const CLOUD_FALLBACK_URL = 'https://api.restful-api.dev/objects/ff808181a09d98f701a167ef41fd68aa';
  const API_ENDPOINT = '/api/sync-users';

  let syncTimer = null;
  let isInternalUpdate = false;
  let allUsersData = { users: [] };

  // 1. Fetch all users from Cloud Database
  async function fetchUsersFromCloud() {
    try {
      // Try local/Vercel serverless API first
      let res = await fetch(`${API_ENDPOINT}?t=${Date.now()}`);
      if (!res.ok) {
        // Fallback to direct cloud database
        res = await fetch(`${CLOUD_FALLBACK_URL}?t=${Date.now()}`);
      }
      
      const data = await res.json();
      const users = (data && Array.isArray(data.users)) 
        ? data.users 
        : (data && data.data && Array.isArray(data.data.users))
          ? data.data.users
          : null;

      if (users && users.length > 0) {
        allUsersData.users = users;
        window.duoscreenUsers = users;
        return users;
      }
    } catch (err) {
      console.warn('☁️ [DuoScreen Sync] Đang thử kết nối trực tiếp đám mây...', err.message);
      try {
        const directRes = await fetch(`${CLOUD_FALLBACK_URL}?t=${Date.now()}`);
        const directData = await directRes.json();
        const users = directData?.data?.users || directData?.users;
        if (users && Array.isArray(users)) {
          allUsersData.users = users;
          window.duoscreenUsers = users;
          return users;
        }
      } catch (e2) {
        console.error('❌ [DuoScreen Sync] Lỗi tải dữ liệu người dùng từ Cloud:', e2);
      }
    }
    return null;
  }

  // 2. Save all users data to Cloud Database
  function saveUsersToCloud() {
    if (isInternalUpdate) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
      try {
        console.log('☁️ [DuoScreen Sync] Đang lưu dữ liệu lên Cloud...');
        const payload = { users: allUsersData.users };

        // Save via internal API
        fetch(API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).catch(() => {});

        // Also save directly to cloud master for 100% guarantee
        const putRes = await fetch(CLOUD_FALLBACK_URL, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'duoscreen_carplay_users',
            data: payload
          })
        });

        if (putRes.ok) {
          console.log('🎉 ☁️ [DuoScreen Sync] Đã đồng bộ hồ sơ và playlist lên Cloud thành công!');
        }
      } catch (err) {
        console.error('❌ ☁️ [DuoScreen Sync] Lỗi lưu lên Cloud:', err);
      }
    }, 600);
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

    console.log(`✅ [DuoScreen] Đang dùng hồ sơ: ${user.name} (${user.avatar})`);
  }

  // 4. Create new user
  function createNewUser(name, avatar) {
    const trimmed = (name || '').trim() || 'Tài xế mới';
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
    saveUsersToCloud();
    return newUser;
  }

  // 5. Hook into Storage.prototype.setItem to capture playlist & profile edits
  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    originalSetItem.apply(this, arguments);

    if (isInternalUpdate) return;

    const activeUserId = localStorage.getItem('douscreen_active_user_id');

    // If playlists updated
    if (key === 'douscreen_playlists') {
      try {
        const playlists = JSON.parse(value);
        if (Array.isArray(allUsersData.users)) {
          const user = allUsersData.users.find(u => u.id === activeUserId) || allUsersData.users[0];
          if (user) {
            user.playlists = playlists;
            saveUsersToCloud();
          }
        }
      } catch (e) {}
    }

    // If driver profile updated
    if (key === 'douscreen_driver_profile') {
      try {
        const profile = JSON.parse(value);
        if (Array.isArray(allUsersData.users)) {
          const user = allUsersData.users.find(u => u.id === activeUserId) || allUsersData.users[0];
          if (user && profile) {
            user.name = profile.name || user.name;
            user.avatar = profile.avatar || user.avatar;
            saveUsersToCloud();
          }
        }
      } catch (e) {}
    }
  };

  // 6. Expose Global Multi-User API for the React UI
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

  // 7. Auto-sync data when window/tab is focused
  window.addEventListener('focus', async () => {
    const users = await fetchUsersFromCloud();
    if (users && users.length > 0) {
      const activeUserId = localStorage.getItem('douscreen_active_user_id');
      const activeUser = users.find(u => u.id === activeUserId) || users[0];
      if (activeUser) {
        isInternalUpdate = true;
        localStorage.setItem('douscreen_playlists', JSON.stringify(activeUser.playlists || []));
        localStorage.setItem('douscreen_driver_profile', JSON.stringify({
          name: activeUser.name,
          avatar: activeUser.avatar || '🚗'
        }));
        isInternalUpdate = false;
        window.dispatchEvent(new Event('storage'));
      }
    }
  });

  // 8. Main Initialization
  async function init() {
    console.log('☁️ [DuoScreen Sync] Khởi động hệ thống đồng bộ Cloud Multi-User...');

    const users = await fetchUsersFromCloud();
    const activeUserId = localStorage.getItem('douscreen_active_user_id');

    if (users && users.length > 0) {
      allUsersData.users = users;
      window.duoscreenUsers = users;

      // Prefer user "Dự Bùi" if first time or default
      let targetUser = users.find(u => u.id === activeUserId);
      if (!targetUser) {
        targetUser = users.find(u => u.name === 'Dự Bùi') || users[0];
      }

      if (targetUser) {
        switchActiveUser(targetUser);
        console.log(`☁️ [DuoScreen Sync] Đã đồng bộ tài khoản: ${targetUser.name} (${targetUser.avatar})`);
      }
    } else {
      // Fallback user if completely offline
      const fallbackUser = {
        id: 'user_dubui',
        name: 'Dự Bùi',
        avatar: '🏎️',
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
      allUsersData = { users: [fallbackUser] };
      window.duoscreenUsers = [fallbackUser];
      if (!activeUserId) {
        switchActiveUser(fallbackUser);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
