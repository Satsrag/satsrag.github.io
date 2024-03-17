'use strict';
const MANIFEST = 'flutter-app-manifest';
const TEMP = 'flutter-temp-cache';
const CACHE_NAME = 'flutter-app-cache';

const RESOURCES = {"version.json": "1e98a4f7390d2e9d9ad60c99fb0aff05",
"index.html": "c8397af9680080011892fa6cd5922af8",
"/": "c8397af9680080011892fa6cd5922af8",
"main.dart.js": "0cfeba0140fdb43e0d81b6fc3c34d9fc",
"flutter.js": "4af2b91eb221b73845365e1302528f07",
"favicon.png": "5dcef449791fa27946b3d35ad8803796",
"icons/Icon-192.png": "ac9a721a12bbc803b44f645561ecb1e1",
"icons/Icon-maskable-192.png": "c457ef57daa1d16f64b27b786ec2ea3c",
"icons/Icon-maskable-512.png": "301a7604d45b3e739efc881eb04896ea",
"icons/Icon-512.png": "96e752610906ba2a93c65f8abe1645f1",
"manifest.json": "c81f25a8d1362ede544c1913a9c96ac1",
".git/config": "d75d7a03e558717571e33ae2fca743e8",
".git/objects/57/15531bf0416a451b971b22e0fd052980111bca": "41b774adb2d150f7f1beeaf50d40a0d9",
".git/objects/d6/26c90b586c34108186020a60e176c3758ad8f7": "c8f628f8a8d7bef39b4803a32aa1b22b",
".git/objects/pack/pack-40535784db539c68c156bb4af06b7539bec8a0e0.idx": "e8e5b8743d44ec10b145742cb886c10f",
".git/objects/pack/pack-40535784db539c68c156bb4af06b7539bec8a0e0.rev": "30b451ede2d7d7a4d70e973db9b2548d",
".git/objects/pack/pack-40535784db539c68c156bb4af06b7539bec8a0e0.pack": "e236ab5c8b827f16ee7539170d61076f",
".git/objects/d5/f11fa5188ab85c3523102a9cb7e518784f6ccc": "c29ce1b7ec8a3ba4a1790def8a71fe5a",
".git/HEAD": "4cf2d64e44205fe628ddd534e1151b58",
".git/info/exclude": "036208b4a1ab4a235d75c181e685e5a3",
".git/logs/HEAD": "fcb2ad8dde9e15718f1dc7c3845cc2d2",
".git/logs/refs/heads/master": "fcb2ad8dde9e15718f1dc7c3845cc2d2",
".git/logs/refs/remotes/origin/HEAD": "dcf3570ae82f274b6a5ba0afa61e53ae",
".git/logs/refs/remotes/origin/master": "0657f276e9b331c93aa2b0452bcf0cdf",
".git/description": "a0a7c3fff21f2aea3cfa1d0316dd816c",
".git/hooks/commit-msg.sample": "579a3c1e12a1e74a98169175fb913012",
".git/hooks/pre-rebase.sample": "56e45f2bcbc8226d2b4200f7c46371bf",
".git/hooks/sendemail-validate.sample": "4d67df3a8d5c98cb8565c07e42be0b04",
".git/hooks/pre-commit.sample": "305eadbbcd6f6d2567e033ad12aabbc4",
".git/hooks/applypatch-msg.sample": "ce562e08d8098926a3862fc6e7905199",
".git/hooks/fsmonitor-watchman.sample": "a0b2633a2c8e97501610bd3f73da66fc",
".git/hooks/pre-receive.sample": "2ad18ec82c20af7b5926ed9cea6aeedd",
".git/hooks/prepare-commit-msg.sample": "2b5c047bdb474555e1787db32b2d2fc5",
".git/hooks/post-update.sample": "2b7ea5cee3c49ff53d41e00785eb974c",
".git/hooks/pre-merge-commit.sample": "39cb268e2a85d436b9eb6f47614c3cbc",
".git/hooks/pre-applypatch.sample": "054f9ffb8bfe04a599751cc757226dda",
".git/hooks/pre-push.sample": "2c642152299a94e05ea26eae11993b13",
".git/hooks/update.sample": "647ae13c682f7827c22f5fc08a03674e",
".git/hooks/push-to-checkout.sample": "c7ab00c7784efeadad3ae9b228d4b4db",
".git/refs/heads/master": "f678065309a27c288b35bb3510a57a66",
".git/refs/remotes/origin/HEAD": "73a00957034783b7b5c8294c54cd3e12",
".git/refs/remotes/origin/master": "f678065309a27c288b35bb3510a57a66",
".git/index": "f877e92b85198fb3a84d0e3617ddc61a",
".git/packed-refs": "7b9643f4ca589bf5f98529fc6cb8032c",
".git/COMMIT_EDITMSG": "507f476de9fbba529abf77be408e607e",
"assets/AssetManifest.json": "355836fdaf92f49c07209cd4f2a805bf",
"assets/NOTICES": "0e891df7f1703f3d09e7980d8c370535",
"assets/FontManifest.json": "f1b75ad9fa09d24c89fc15f7490c6444",
"assets/AssetManifest.bin.json": "edc9e142559a4dfaa7fc1c38a0582e9d",
"assets/packages/zcode_embed_ime_db/sqlite3.wasm": "91f3e6deef838b810d9ee3c8cc750eba",
"assets/packages/zcode_embed_ime_db/db/zcode_ime.db": "0b10c3db6082496c14e0cd14176f347b",
"assets/packages/cupertino_icons/assets/CupertinoIcons.ttf": "89ed8f4e49bcdfc0b5bfc9b24591e347",
"assets/packages/menk_embed_ime_db/sqlite3.wasm": "91f3e6deef838b810d9ee3c8cc750eba",
"assets/packages/menk_embed_ime_db/db/menk_ime.db": "3c639319d66df77b42b7c1b53d9bf4ad",
"assets/shaders/ink_sparkle.frag": "ecc85a2e95f5e9f53123dcaf8cb9b6ce",
"assets/AssetManifest.bin": "a79b5df5a20075a3c02b3ca97d87429b",
"assets/fonts/MQG8F02.ttf": "a970fff239843a3922452da8568dd6ce",
"assets/fonts/MaterialIcons-Regular.otf": "22170409c1d89f5d6d7a7fdd51566bce",
"assets/fonts/z52tsagaantig.ttf": "a3fdb2bc8d915ba3b0ddeaf387f993e7",
"canvaskit/skwasm.js": "445e9e400085faead4493be2224d95aa",
"canvaskit/skwasm.js.symbols": "ef917dfd72f2277ded2558c26e5f05b4",
"canvaskit/canvaskit.js.symbols": "262f1e87a7e03b5220896ef26cf6cd59",
"canvaskit/skwasm.wasm": "978be5b60b1dd3f397d3eeaf961bd0f1",
"canvaskit/chromium/canvaskit.js.symbols": "41ec885f0fee654e57955f0bda76f83d",
"canvaskit/chromium/canvaskit.js": "2f82009588e8a72043db753d360d488f",
"canvaskit/chromium/canvaskit.wasm": "8d1935d36c47b6427a4b41947d484d90",
"canvaskit/canvaskit.js": "7737f5fc722b6a040ac15271ea8d92fb",
"canvaskit/canvaskit.wasm": "54d90bc9d529698704732e3d7752563d",
"canvaskit/skwasm.worker.js": "bfb704a6c714a75da9ef320991e88b03"};
// The application shell files that are downloaded before a service worker can
// start.
const CORE = ["main.dart.js",
"index.html",
"assets/AssetManifest.bin.json",
"assets/FontManifest.json"];

// During install, the TEMP cache is populated with the application shell files.
self.addEventListener("install", (event) => {
  self.skipWaiting();
  return event.waitUntil(
    caches.open(TEMP).then((cache) => {
      return cache.addAll(
        CORE.map((value) => new Request(value, {'cache': 'reload'})));
    })
  );
});
// During activate, the cache is populated with the temp files downloaded in
// install. If this service worker is upgrading from one with a saved
// MANIFEST, then use this to retain unchanged resource files.
self.addEventListener("activate", function(event) {
  return event.waitUntil(async function() {
    try {
      var contentCache = await caches.open(CACHE_NAME);
      var tempCache = await caches.open(TEMP);
      var manifestCache = await caches.open(MANIFEST);
      var manifest = await manifestCache.match('manifest');
      // When there is no prior manifest, clear the entire cache.
      if (!manifest) {
        await caches.delete(CACHE_NAME);
        contentCache = await caches.open(CACHE_NAME);
        for (var request of await tempCache.keys()) {
          var response = await tempCache.match(request);
          await contentCache.put(request, response);
        }
        await caches.delete(TEMP);
        // Save the manifest to make future upgrades efficient.
        await manifestCache.put('manifest', new Response(JSON.stringify(RESOURCES)));
        // Claim client to enable caching on first launch
        self.clients.claim();
        return;
      }
      var oldManifest = await manifest.json();
      var origin = self.location.origin;
      for (var request of await contentCache.keys()) {
        var key = request.url.substring(origin.length + 1);
        if (key == "") {
          key = "/";
        }
        // If a resource from the old manifest is not in the new cache, or if
        // the MD5 sum has changed, delete it. Otherwise the resource is left
        // in the cache and can be reused by the new service worker.
        if (!RESOURCES[key] || RESOURCES[key] != oldManifest[key]) {
          await contentCache.delete(request);
        }
      }
      // Populate the cache with the app shell TEMP files, potentially overwriting
      // cache files preserved above.
      for (var request of await tempCache.keys()) {
        var response = await tempCache.match(request);
        await contentCache.put(request, response);
      }
      await caches.delete(TEMP);
      // Save the manifest to make future upgrades efficient.
      await manifestCache.put('manifest', new Response(JSON.stringify(RESOURCES)));
      // Claim client to enable caching on first launch
      self.clients.claim();
      return;
    } catch (err) {
      // On an unhandled exception the state of the cache cannot be guaranteed.
      console.error('Failed to upgrade service worker: ' + err);
      await caches.delete(CACHE_NAME);
      await caches.delete(TEMP);
      await caches.delete(MANIFEST);
    }
  }());
});
// The fetch handler redirects requests for RESOURCE files to the service
// worker cache.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== 'GET') {
    return;
  }
  var origin = self.location.origin;
  var key = event.request.url.substring(origin.length + 1);
  // Redirect URLs to the index.html
  if (key.indexOf('?v=') != -1) {
    key = key.split('?v=')[0];
  }
  if (event.request.url == origin || event.request.url.startsWith(origin + '/#') || key == '') {
    key = '/';
  }
  // If the URL is not the RESOURCE list then return to signal that the
  // browser should take over.
  if (!RESOURCES[key]) {
    return;
  }
  // If the URL is the index.html, perform an online-first request.
  if (key == '/') {
    return onlineFirst(event);
  }
  event.respondWith(caches.open(CACHE_NAME)
    .then((cache) =>  {
      return cache.match(event.request).then((response) => {
        // Either respond with the cached resource, or perform a fetch and
        // lazily populate the cache only if the resource was successfully fetched.
        return response || fetch(event.request).then((response) => {
          if (response && Boolean(response.ok)) {
            cache.put(event.request, response.clone());
          }
          return response;
        });
      })
    })
  );
});
self.addEventListener('message', (event) => {
  // SkipWaiting can be used to immediately activate a waiting service worker.
  // This will also require a page refresh triggered by the main worker.
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
    return;
  }
  if (event.data === 'downloadOffline') {
    downloadOffline();
    return;
  }
});
// Download offline will check the RESOURCES for all files not in the cache
// and populate them.
async function downloadOffline() {
  var resources = [];
  var contentCache = await caches.open(CACHE_NAME);
  var currentContent = {};
  for (var request of await contentCache.keys()) {
    var key = request.url.substring(origin.length + 1);
    if (key == "") {
      key = "/";
    }
    currentContent[key] = true;
  }
  for (var resourceKey of Object.keys(RESOURCES)) {
    if (!currentContent[resourceKey]) {
      resources.push(resourceKey);
    }
  }
  return contentCache.addAll(resources);
}
// Attempt to download the resource online before falling back to
// the offline cache.
function onlineFirst(event) {
  return event.respondWith(
    fetch(event.request).then((response) => {
      return caches.open(CACHE_NAME).then((cache) => {
        cache.put(event.request, response.clone());
        return response;
      });
    }).catch((error) => {
      return caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          if (response != null) {
            return response;
          }
          throw error;
        });
      });
    })
  );
}
