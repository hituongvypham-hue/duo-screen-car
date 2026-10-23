(function () {
  const GITHUB_TOKEN = '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';
  const GITHUB_REPO = 'hituongvypham-hue/duo-screen-car';
  const GITHUB_FILE = 'users_data.json';

  let currentSha = null;
  let syncTimer = null;
  let isInternalUpdate = false;
  let allUsersData = { users: [] };

  const AVATAR_OPTIONS = ['🚗', '🏎️', '🚙', '🚕', '🏍️', '🎵', '🎧', '🕶️', '👑', '🚀', '🏖️', '⚡', '🌟', '🔥'];

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

    const modal = document.getElementById('duoscreen-user-modal');
    if (modal) modal.remove();

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
    switchActiveUser(newUser);
    saveUsersToGithub();
  }

  // 5. Render User Selection Modal
  function showUserModal(users, isSwitching) {
    const existingModal = document.getElementById('duoscreen-user-modal');
    if (existingModal) existingModal.remove();

    let selectedAvatar = '🚗';

    const overlay = document.createElement('div');
    overlay.id = 'duoscreen-user-modal';
    overlay.className = 'fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-xl animate-fadeIn select-none';

    overlay.innerHTML = `
      <div class="relative w-full max-w-lg bg-gradient-to-b from-[#131722] via-[#0d1019] to-[#07090e] border border-cyan-500/40 rounded-3xl p-5 sm:p-7 shadow-[0_0_50px_rgba(6,182,212,0.15)] text-white max-h-[92vh] overflow-y-auto">
        ${isSwitching ? `
          <button id="modal-close-btn" class="absolute top-4 right-4 p-2 text-neutral-400 hover:text-white rounded-full bg-neutral-800/80 transition" title="Đóng">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        ` : ''}

        <div class="text-center mb-6">
          <div class="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 shadow-lg shadow-cyan-500/30 mb-3 text-3xl">🚗</div>
          <h2 class="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            <span>${isSwitching ? 'Chuyển Đổi Hồ Sơ Người Dùng' : 'Chọn Hồ Sơ Người Dùng'}</span>
          </h2>
          <p class="text-xs sm:text-sm text-neutral-400 mt-1">
            ${isSwitching ? 'Chọn hồ sơ đã lưu hoặc tạo thêm tài xế mới' : 'Chào mừng bạn! Chọn hồ sơ đã lưu hoặc tạo mới để đồng bộ playlist.'}
          </p>
        </div>

        <!-- Danh sách user có sẵn -->
        <div class="space-y-2.5 mb-6">
          <div class="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Hồ sơ đã lưu trên GitHub (${users.length})</span>
            <span class="text-cyan-400 text-[10px]">☁️ Tự động đồng bộ</span>
          </div>

          <div id="users-list" class="space-y-2 max-h-48 overflow-y-auto pr-1">
            ${users.map(u => {
              const countPlaylists = (u.playlists || []).length;
              let totalVideos = 0;
              (u.playlists || []).forEach(p => totalVideos += (p.videos || []).length);
              return `
                <button type="button" data-user-id="${u.id}" class="user-select-card w-full flex items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-neutral-900/90 hover:bg-neutral-800/90 border border-neutral-800 hover:border-cyan-500/50 transition active:scale-[0.98] group text-left">
                  <div class="flex items-center gap-3">
                    <div class="w-11 h-11 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                      ${u.avatar || '🚗'}
                    </div>
                    <div>
                      <div class="font-bold text-sm sm:text-base text-white group-hover:text-cyan-300 transition-colors">${u.name}</div>
                      <div class="text-[11px] text-neutral-400">${countPlaylists} danh sách • ${totalVideos} bài hát</div>
                    </div>
                  </div>
                  <div class="px-3 py-1.5 rounded-xl bg-cyan-600/20 group-hover:bg-cyan-600 border border-cyan-500/40 text-cyan-400 group-hover:text-white font-bold text-xs transition">
                    Chọn
                  </div>
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Nút mở form tạo user mới -->
        <div class="border-t border-neutral-800/80 pt-5">
          <div id="create-user-section" class="hidden">
            <h3 class="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <span class="text-cyan-400">+</span> Tạo hồ sơ người dùng mới
            </h3>
            <div class="mb-3">
              <label class="block text-[11px] font-semibold text-neutral-400 mb-1">Tên của bạn / Tên xe</label>
              <input id="new-user-name" type="text" placeholder="Ví dụ: Vy, Gia đình, Anh Tuấn..." class="w-full bg-neutral-950 border border-neutral-700 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none transition" />
            </div>

            <div class="mb-4">
              <label class="block text-[11px] font-semibold text-neutral-400 mb-1.5">Chọn biểu tượng đại diện</label>
              <div class="flex flex-wrap gap-2" id="avatar-picker">
                ${AVATAR_OPTIONS.map((a, i) => `
                  <button type="button" data-avatar="${a}" class="avatar-option w-9 h-9 rounded-xl border flex items-center justify-center text-lg transition ${i === 0 ? 'bg-cyan-600/30 border-cyan-400 scale-105' : 'bg-neutral-900 border-neutral-700 hover:border-neutral-500'}">
                    ${a}
                  </button>
                `).join('')}
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button id="btn-submit-new-user" type="button" class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-600/30 transition active:scale-95">
                Tạo & Bắt đầu
              </button>
              <button id="btn-cancel-new-user" type="button" class="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white text-sm transition">
                Hủy
              </button>
            </div>
          </div>

          <button id="btn-show-create" type="button" class="w-full py-3 rounded-2xl border border-dashed border-neutral-700 hover:border-cyan-500/60 bg-neutral-900/40 hover:bg-neutral-900/80 text-cyan-400 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition active:scale-95">
            <span>+</span>
            <span>Tạo một hồ sơ người dùng mới</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Event listeners
    if (isSwitching) {
      const closeBtn = document.getElementById('modal-close-btn');
      if (closeBtn) closeBtn.onclick = () => overlay.remove();
    }

    // Select existing user
    overlay.querySelectorAll('.user-select-card').forEach(btn => {
      btn.onclick = () => {
        const uid = btn.getAttribute('data-user-id');
        const user = (allUsersData.users || []).find(u => u.id === uid);
        if (user) switchActiveUser(user);
      };
    });

    // Toggle create section
    const showCreateBtn = document.getElementById('btn-show-create');
    const createSection = document.getElementById('create-user-section');
    const cancelNewUserBtn = document.getElementById('btn-cancel-new-user');

    showCreateBtn.onclick = () => {
      showCreateBtn.classList.add('hidden');
      createSection.classList.remove('hidden');
      const nameInput = document.getElementById('new-user-name');
      if (nameInput) nameInput.focus();
    };

    cancelNewUserBtn.onclick = () => {
      createSection.classList.add('hidden');
      showCreateBtn.classList.remove('hidden');
    };

    // Avatar pick
    overlay.querySelectorAll('.avatar-option').forEach(btn => {
      btn.onclick = () => {
        overlay.querySelectorAll('.avatar-option').forEach(b => {
          b.className = 'avatar-option w-9 h-9 rounded-xl border flex items-center justify-center text-lg transition bg-neutral-900 border-neutral-700 hover:border-neutral-500';
        });
        btn.className = 'avatar-option w-9 h-9 rounded-xl border flex items-center justify-center text-lg transition bg-cyan-600/30 border-cyan-400 scale-105';
        selectedAvatar = btn.getAttribute('data-avatar');
      };
    });

    // Submit new user
    const submitBtn = document.getElementById('btn-submit-new-user');
    submitBtn.onclick = () => {
      const name = (document.getElementById('new-user-name').value || '').trim();
      createNewUser(name || 'Tài xế', selectedAvatar);
    };
  }

  // 6. Hook into Storage.prototype.setItem
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

  // 7. Inject "Đổi tài xế / Switch Profile" button on UI
  function injectSwitchButton() {
    if (document.getElementById('btn-switch-profile')) return;

    const switchBtn = document.createElement('button');
    switchBtn.id = 'btn-switch-profile';
    switchBtn.className = 'fixed bottom-4 right-4 z-40 px-3.5 py-2 rounded-2xl bg-neutral-900/90 hover:bg-neutral-800 text-cyan-400 hover:text-white border border-cyan-500/40 hover:border-cyan-400 shadow-xl backdrop-blur-md text-xs font-bold flex items-center gap-1.5 transition active:scale-95';
    switchBtn.title = 'Đổi tài xế / Chọn hồ sơ người dùng';
    switchBtn.innerHTML = `
      <span>🔄</span>
      <span class="hidden sm:inline">Đổi hồ sơ</span>
    `;

    switchBtn.onclick = () => {
      showUserModal(allUsersData.users || [], true);
    };

    document.body.appendChild(switchBtn);
  }

  // 8. Main Initialization
  async function init() {
    console.log('☁️ [DuoScreen Sync] Khởi động hệ thống Multi-User Profiles...');

    const users = await fetchUsersFromGithub();
    const activeUserId = localStorage.getItem('douscreen_active_user_id');

    if (users && users.length > 0) {
      allUsersData.users = users;

      if (!activeUserId) {
        // LẦN ĐẦU MỞ TRÌNH DUYỆT MỚI: Hiển thị ngay modal chọn User!
        showUserModal(users, false);
      } else {
        // Đã có user trên trình duyệt này: Tải playlist mới nhất của user đó
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
          showUserModal(users, false);
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
      if (!activeUserId) {
        showUserModal([initialUser], false);
      }
    }

    injectSwitchButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
