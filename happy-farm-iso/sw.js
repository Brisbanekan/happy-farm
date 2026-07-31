/* 最小 Service Worker：只為滿足 PWA 可安裝條件（WebAPK → 開啟即全螢幕）。
   不做任何快取，所有請求直接走網路，避免部署新版被舊快取卡住。 */
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function(e){ /* 不攔截：預設直接走網路 */ });
