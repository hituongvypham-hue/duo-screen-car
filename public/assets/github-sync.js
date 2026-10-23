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

  // 5. Render User Selection Modal with 100% Inline CSS
  function showUserModal(users, isSwitching) {
    const existingModal = document.getElementById('duoscreen-user-modal');
    if (existingModal) existingModal.remove();

    let selectedAvatar = '🚗';

    const overlay = document.createElement('div');
    overlay.id = 'duoscreen-user-modal';
    overlay.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      z-index: 2147483647 !important;
      background: rgba(0, 0, 0, 0.85) !important;
      backdrop-filter: blur(14px) !important;
      -webkit-backdrop-filter: blur(14px) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 16px !important;
      box-sizing: border-box !important;
      user-select: none !important;
      margin: 0 !important;
    `;

    overlay.innerHTML = `
      <div style="position: relative; width: 100%; max-width: 520px; max-height: 88vh; overflow-y: auto; background: linear-gradient(180deg, #131722 0%, #0d1019 60%, #07090e 100%); border: 2px solid rgba(6,182,212,0.6); border-radius: 28px; padding: 26px; box-shadow: 0 0 60px rgba(6,182,212,0.3); color: #fff; box-sizing: border-box; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <!-- Close button -->
        <button id="modal-close-btn" style="position: absolute; top: 16px; right: 16px; width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; transition: background 0.2s;" title="Đóng">
          ✕
        </button>

        <div style="text-align: center; margin-bottom: 22px;">
          <div style="display: inline-flex; padding: 12px; border-radius: 18px; background: linear-gradient(135deg, #0891b2, #2563eb); box-shadow: 0 6px 20px rgba(6,182,212,0.4); margin-bottom: 12px; font-size: 32px;">🚗</div>
          <h2 style="font-size: 22px; font-weight: 900; margin: 0 0 6px 0; color: #fff; letter-spacing: -0.5px;">
            ${isSwitching ? 'Chuyển Đổi Hồ Sơ Người Dùng' : 'Chọn Hồ Sơ Tài Xế'}
          </h2>
          <p style="font-size: 13px; color: #94a3b8; margin: 0;">
            ${isSwitching ? 'Chọn hồ sơ đã lưu hoặc tạo thêm tài xế mới' : 'Chào mừng bạn! Chọn hồ sơ đã lưu để đồng bộ bài hát cá nhân.'}
          </p>
        </div>

        <!-- Danh sách user có sẵn -->
        <div style="margin-bottom: 20px;">
          <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
            <span>HỒ SƠ ĐÃ LƯU TRÊN GITHUB (${users.length})</span>
            <span style="color: #22d3ee; font-size: 11px; font-weight: 600;">☁️ Đồng bộ tự động</span>
          </div>

          <div id="users-list" style="display: flex; flex-direction: column; gap: 10px; max-height: 220px; overflow-y: auto; padding-right: 4px;">
            ${users.map(u => {
              const countPlaylists = (u.playlists || []).length;
              let totalVideos = 0;
              (u.playlists || []).forEach(p => totalVideos += (p.videos || []).length);
              return `
                <div data-user-id="${u.id}" class="user-select-card" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-radius: 18px; background: rgba(23, 29, 43, 0.9); border: 1.5px solid rgba(255,255,255,0.08); cursor: pointer; transition: all 0.2s;">
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 44px; height: 44px; border-radius: 14px; background: #0f172a; border: 1px solid #334155; display: flex; align-items: center; justify-content: center; font-size: 24px;">
                      ${u.avatar || '🚗'}
                    </div>
                    <div>
                      <div style="font-weight: 700; font-size: 15px; color: #fff;">${u.name}</div>
                      <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">${countPlaylists} danh sách • ${totalVideos} bài hát</div>
                    </div>
                  </div>
                  <button type="button" style="padding: 6px 14px; border-radius: 12px; background: #0891b2; color: #fff; font-weight: 700; font-size: 12px; border: none; cursor: pointer; pointer-events: none;">
                    Chọn
                  </button>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Nút mở form tạo user mới -->
        <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 18px;">
          <div id="create-user-section" style="display: none;">
            <h3 style="font-size: 14px; font-weight: 800; color: #fff; margin: 0 0 12px 0; display: flex; align-items: center; gap: 6px;">
              <span style="color: #22d3ee;">+</span> Tạo hồ sơ người dùng mới
            </h3>
            <div style="margin-bottom: 12px;">
              <label style="display: block; font-size: 11px; font-weight: 600; color: #94a3b8; margin-bottom: 6px;">Tên của bạn / Tên xe</label>
              <input id="new-user-name" type="text" placeholder="Ví dụ: Vy, Gia đình, Anh Tuấn..." style="width: 100%; background: #030712; border: 1px solid #374151; border-radius: 12px; padding: 10px 14px; font-size: 14px; color: #fff; box-sizing: border-box; outline: none;" />
            </div>

            <div style="margin-bottom: 16px;">
              <label style="display: block; font-size: 11px; font-weight: 600; color: #94a3b8; margin-bottom: 6px;">Chọn biểu tượng đại diện</label>
              <div id="avatar-picker" style="display: flex; flex-wrap: wrap; gap: 8px;">
                ${AVATAR_OPTIONS.map((a, i) => `
                  <button type="button" data-avatar="${a}" class="avatar-option" style="width: 38px; height: 38px; border-radius: 12px; border: 1.5px solid ${i === 0 ? '#06b6d4' : '#334155'}; background: ${i === 0 ? 'rgba(6,182,212,0.25)' : '#0f172a'}; display: flex; align-items: center; justify-content: center; font-size: 18px; cursor: pointer; transition: all 0.15s;">
                    ${a}
                  </button>
                `).join('')}
              </div>
            </div>

            <div style="display: flex; gap: 10px;">
              <button id="btn-submit-new-user" type="button" style="flex: 1; padding: 11px; border-radius: 14px; background: linear-gradient(135deg, #0891b2, #2563eb); color: #fff; font-weight: 800; font-size: 14px; border: none; cursor: pointer; box-shadow: 0 4px 14px rgba(6,182,212,0.3);">
                Tạo & Bắt đầu
              </button>
              <button id="btn-cancel-new-user" type="button" style="padding: 11px 18px; border-radius: 14px; background: #1e293b; color: #94a3b8; font-weight: 600; font-size: 14px; border: none; cursor: pointer;">
                Hủy
              </button>
            </div>
          </div>

          <button id="btn-show-create" type="button" style="width: 100%; padding: 12px; border-radius: 16px; border: 1.5px dashed #0891b2; background: rgba(8,145,178,0.1); color: #22d3ee; font-weight: 700; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: all 0.2s;">
            <span>+ Tạo một hồ sơ người dùng mới</span>
          </button>

          <button id="btn-skip-modal" type="button" style="width: 100%; margin-top: 10px; padding: 10px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: #94a3b8; font-size: 12px; font-weight: 600; cursor: pointer;">
            Bỏ qua & Tiếp tục lái xe ➜
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeModal = () => {
      overlay.remove();
      const currentActive = localStorage.getItem('douscreen_active_user_id');
      if (!currentActive && users && users.length > 0) {
        switchActiveUser(users[0]);
      }
    };

    // Close handlers
    const closeBtn = document.getElementById('modal-close-btn');
    if (closeBtn) closeBtn.onclick = closeModal;

    const skipBtn = document.getElementById('btn-skip-modal');
    if (skipBtn) skipBtn.onclick = closeModal;

    overlay.onclick = (e) => {
      if (e.target === overlay) closeModal();
    };

    // Select existing user
    overlay.querySelectorAll('.user-select-card').forEach(btn => {
      btn.onclick = () => {
        const uid = btn.getAttribute('data-user-id');
        const user = (allUsersData.users || []).find(u => u.id === uid);
        if (user) switchActiveUser(user);
      };
      btn.onmouseenter = () => {
        btn.style.borderColor = 'rgba(6,182,212,0.8)';
        btn.style.background = 'rgba(30, 41, 59, 0.95)';
      };
      btn.onmouseleave = () => {
        btn.style.borderColor = 'rgba(255,255,255,0.08)';
        btn.style.background = 'rgba(23, 29, 43, 0.9)';
      };
    });

    // Toggle create section
    const showCreateBtn = document.getElementById('btn-show-create');
    const createSection = document.getElementById('create-user-section');
    const cancelNewUserBtn = document.getElementById('btn-cancel-new-user');

    showCreateBtn.onclick = () => {
      showCreateBtn.style.display = 'none';
      if (skipBtn) skipBtn.style.display = 'none';
      createSection.style.display = 'block';
      const nameInput = document.getElementById('new-user-name');
      if (nameInput) nameInput.focus();
    };

    cancelNewUserBtn.onclick = () => {
      createSection.style.display = 'none';
      showCreateBtn.style.display = 'flex';
      if (skipBtn) skipBtn.style.display = 'block';
    };

    // Avatar pick
    overlay.querySelectorAll('.avatar-option').forEach(btn => {
      btn.onclick = () => {
        overlay.querySelectorAll('.avatar-option').forEach(b => {
          b.style.borderColor = '#334155';
          b.style.background = '#0f172a';
          b.style.transform = 'scale(1)';
        });
        btn.style.borderColor = '#06b6d4';
        btn.style.background = 'rgba(6,182,212,0.25)';
        btn.style.transform = 'scale(1.08)';
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
    switchBtn.style.cssText = `
      position: fixed !important;
      bottom: 16px !important;
      right: 16px !important;
      z-index: 99999 !important;
      padding: 8px 14px !important;
      border-radius: 16px !important;
      background: rgba(15, 23, 42, 0.95) !important;
      color: #22d3ee !important;
      border: 1.5px solid rgba(6, 182, 212, 0.5) !important;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important;
      backdrop-filter: blur(8px) !important;
      -webkit-backdrop-filter: blur(8px) !important;
      font-size: 12px !important;
      font-weight: 700 !important;
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
      cursor: pointer !important;
      transition: all 0.2s !important;
      user-select: none !important;
    `;
    switchBtn.title = 'Đổi tài xế / Chọn hồ sơ người dùng';
    switchBtn.innerHTML = `
      <span>🔄</span>
      <span>Đổi hồ sơ</span>
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
        // LẦN ĐẦU MỞ TRÌNH DUYỆT MỚI: Tự động dùng user đầu tiên và gợi ý chọn nếu muốn
        isInternalUpdate = true;
        localStorage.setItem('douscreen_playlists', JSON.stringify(users[0].playlists || []));
        localStorage.setItem('douscreen_driver_profile', JSON.stringify({
          name: users[0].name,
          avatar: users[0].avatar || '🚗'
        }));
        isInternalUpdate = false;
        window.dispatchEvent(new Event('storage'));

        // Hiển thị modal toàn màn hình chuẩn xác
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
