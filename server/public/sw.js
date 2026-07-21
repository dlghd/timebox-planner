// Timebox Planner 서비스워커 — 오프라인 실행 + PWA 설치 지원
const CACHE = 'timebox-v1';
const ASSETS = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // 로그인/데이터 등 API 요청은 항상 네트워크로 (동기화 정확성 유지)
  if (['/register', '/login', '/data'].includes(url.pathname)) return;
  if (e.request.method !== 'GET') return;

  // 앱 화면/아이콘 등 정적 파일: 캐시 우선, 없으면 네트워크 후 캐시에 저장
  e.respondWith(
    caches.match(e.request).then(hit =>
      hit ||
      fetch(e.request).then(res => {
        const copy = res.clone();
        if (res.ok && url.origin === location.origin) {
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match('/index.html'))
    )
  );
});
