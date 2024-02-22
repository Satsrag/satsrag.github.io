'use strict';
const MANIFEST = 'flutter-app-manifest';
const TEMP = 'flutter-temp-cache';
const CACHE_NAME = 'flutter-app-cache';

const RESOURCES = {"version.json": "1e98a4f7390d2e9d9ad60c99fb0aff05",
"index.html": "a8694123986ef8218dabf0d220532065",
"/": "a8694123986ef8218dabf0d220532065",
"main.dart.js": "46c96f70b20e4c6b7ce1461a9377a07b",
"sqlite3.wasm": "91f3e6deef838b810d9ee3c8cc750eba",
"flutter.js": "c71a09214cb6f5f8996a531350400a9a",
"old/index.html": "d56cebee6f4b2e02b9e4b170dc658e3c",
"old/CNAME": "d41d8cd98f00b204e9800998ecf8427e",
"old/test1.jpg": "77384e02c26185a58334a3602bc5de44",
"old/test3.jpg": "8e26c9c244e944d689f03cebf863f527",
"old/background.jpg": "adfb2723a434de27fdfc157adecbbe08",
"old/test2.jpg": "f1b30c7435e6894df9c4cd89f5952bd1",
"old/font.css": "00f4ad85f637e88a71a8bd40736f8423",
"old/jquery.js": "e071abda8fe61194711cfc2ab99fe104",
"favicon.png": "5dcef449791fa27946b3d35ad8803796",
"icons/Icon-192.png": "ac9a721a12bbc803b44f645561ecb1e1",
"icons/Icon-maskable-192.png": "c457ef57daa1d16f64b27b786ec2ea3c",
"icons/Icon-maskable-512.png": "301a7604d45b3e739efc881eb04896ea",
"icons/Icon-512.png": "96e752610906ba2a93c65f8abe1645f1",
"manifest.json": "c81f25a8d1362ede544c1913a9c96ac1",
".git/config": "d75d7a03e558717571e33ae2fca743e8",
".git/objects/61/394839163e564f4393e0b41385f7f31f49a154": "f43375bf462da3eac4e66fbf6841cf41",
".git/objects/0c/fb2983a2725cda290b20f8a70caf2a159caa86": "57c422b9d8c672c1bbf74844eb419b66",
".git/objects/6f/9cad4c116bc8d72e2497226abb5c05ee64982c": "0d104480d68c1652a53721377a02a882",
".git/objects/04/e5efc15dc0c60ea2ffcc37c5bf25e96689f44d": "978222f47488835b92838c74cb5c684c",
".git/objects/3c/28a0528e0162fdbb317ed3fffb008f36b2e05d": "a559b5fc228a0bf8a658482cff485da1",
".git/objects/51/0311d87be031f6bd7dc30bb7d3dbfb04316bb7": "f6b82e83ab6123f8387213baf127f7e5",
".git/objects/3d/96dd4b1fa15ad75e8c83963187b4884072dc93": "6e6dab3c1effdb6dadfe997dfa9b341b",
".git/objects/3d/ec414f3612e24fdcb1cc2d2f82bfc20e9d1e26": "11c358aab26aac759e2f98ada03df15d",
".git/objects/94/bfb1463ad8331bfd687bc751b8920b133da744": "fd2d8c0d844b234856b36b93f652048f",
".git/objects/5f/6a467fd5a111863cb653d7196d54df87ce2269": "443514c53198b190d584fefbc85428d6",
".git/objects/05/6cdbb799f8fe36f537166ff6224576194db278": "87745c8f55668be49d18bde9a10b80ee",
".git/objects/9d/9e9519cc48c45a8f8ece19ae1b609f3bd1e777": "99c3bca983ef2ea1d10fdf4ddd9c6dfa",
".git/objects/9d/023e516b2441d9835ae234d867c0e2de0579b5": "5cf14a4a6a3df16bfb8b927e4eacc332",
".git/objects/b5/0254288cc6319d153c4af1d64870d95ee2436f": "468a6506934a07c970a4739eae75eedd",
".git/objects/d7/2c11112c7cb4e2ce754bc41470f9b829a2d00a": "d7280a766a5d6033f187d874a92b5ad6",
".git/objects/d7/47c8c69d1d8e67f1a4554e420fa699e7f3c41c": "4286dd84cd0a5953f5f135bd178ad52f",
".git/objects/bd/b150b2c5bca2d3f39c98091e6cbda739f68bb9": "4e60996cb015ac82aafbca875253a720",
".git/objects/d6/5c0345bf2a0f68a4929ee1d007b4d76f239995": "aaf69deda65560b9360ab3d2f3b5fe30",
".git/objects/f2/04823a42f2d890f945f70d88b8e2d921c6ae26": "6b47f314ffc35cf6a1ced3208ecc857d",
".git/objects/ca/03e81d6c765198713f25e203b7a7db616afbf6": "842bf7f5d7f93fa24e63d11664842bd6",
".git/objects/c6/76db041892250b261652572273c634353cd318": "1d2b8171afc7515438fe38884507aee9",
".git/objects/20/1afe538261bd7f9a38bed0524669398070d046": "82a4d6c731c1d8cdc48bce3ab3c11172",
".git/objects/pack/pack-8581cdffe64423386d6e796beefa459ac9cedcab.pack": "d06f6c1f04d4985b37584993c9b149ae",
".git/objects/pack/pack-8581cdffe64423386d6e796beefa459ac9cedcab.rev": "6d5ab0359780f3ed9c2128d86b5dae65",
".git/objects/pack/pack-8581cdffe64423386d6e796beefa459ac9cedcab.idx": "d53e4efd3c10f785476e6a7453634e7a",
".git/objects/11/6f5e00e6961ab5a05012ae448e9071404a8753": "5dffa5ac2f5dd5f24e11a01de32a5958",
".git/objects/16/5ce0ddf03a820a38f48cba9aa0c9df9b6e6b79": "71df17c95c3124eada62b59e7dabda78",
".git/objects/28/31ac31dda301ef9038f73e30ab6614a5d75830": "f947f38536e046ceadeb2f457d825c35",
".git/objects/8f/620869d4280dbc04893b341dc77746671d3688": "f6e80c0e19a874a4a87e5aeeb56e0443",
".git/objects/88/9935b6a56694817ec4cc5f2220f5ad28d92fc6": "4d8e158405a8dd2928b647c728270fcc",
".git/objects/07/74c17c0fa7a7e87e24a6935830998d92b52c75": "cd62ee54b7ceea7b2a7804e69b1d9134",
".git/objects/53/7807567919e88db2866b7825339c57e94c24d8": "970aec5149a3dbe9370a9dc982cdd022",
".git/objects/52/94ed7017299b825d3946d132f898a0f22f9672": "457da0fa9343ec9a72ac559cd8b3f515",
".git/objects/bf/53c1e96378ae0939598c3aedbe269a64140073": "6f3dd3d4f1b4796406c52f97a631c9e7",
".git/objects/d4/3532a2348cc9c26053ddb5802f0e5d4b8abc05": "3dad9b209346b1723bb2cc68e7e42a44",
".git/objects/ba/8cb00dd5231f1a55de0205c16445926a696526": "be8592f9341c9b01b70890c8614c6cf7",
".git/objects/a0/5b14b7dafa5aa9d4327fb18180c2b62421df04": "8996abf3b573b12db0f5a5df1d36cf70",
".git/objects/dd/ae8a14307ccff1907a0ba28521c198ab045061": "bc5fbfb0cdef7e1b57d461064d8b7581",
".git/objects/af/742adee0a85dd21ea96cbd84182e30e085d6cf": "aa25b932ec40efacb1efe27e7cf25d82",
".git/objects/e1/8a40df3b1b0eb9a61edd992104cd07bcc43495": "5f88dba8827cc39c5a9edb0b0cbbfe32",
".git/objects/cd/5bf4875e5416c9ebfed0bd1d01dcd11080d9f6": "5d31895c5a22c8dd37bd934ee6e9d232",
".git/objects/e6/b745f90f2a4d1ee873fc396496c110db8ff0f3": "2933b2b2ca80c66b96cf80cd73d4cd16",
".git/objects/f7/cf1591d16f2b0280f7f869da05124317a1429d": "655857c8d432e37d0355a23af1011137",
".git/objects/e8/2c5850db3a3482d0c954a4dc122c02de555ce7": "d357cd906b3805bf81477f5527cca086",
".git/objects/c5/f4bc2a4da91586f3005813077f0d0aa9040f82": "3191028b787554cee4652f5050144bff",
".git/objects/f1/4743f9dc81f6b65e34e080f8af79f9e4df2ec2": "063482e98950c593752a036281334c33",
".git/objects/cb/217cc25cc1ddb36822866a9dca16acaa7c32f8": "87867a27d24fdd1aaf43a543fd30c342",
".git/objects/ce/b255a341abb3e28e82728aa57915e0a20f8ce1": "6e7ad1e5d4e64c8779f66b0d953dfaea",
".git/objects/4a/39079e580dc9be820cba2fae41238c49eaa798": "ada1a19fea32fbb6719120809b9eae60",
".git/objects/24/34419fdbf53fd6a2034b9b919baf18386b414b": "9a2846c3468f04b0c7711562bbbea7d6",
".git/objects/24/7d288e7dd351312c299cb661afdfc6f04d270c": "6e68630fe52217b61b445bbcd4f25810",
".git/objects/24/00511ca89726bae208157173b28da0e3824c6c": "592e044d10c2461e53b6cb7208796f34",
".git/objects/71/7117947090611c3967f8681ab1ac0f79bca7fc": "ad4e74c0da46020e04043b5cf7f91098",
".git/objects/71/87a74b5dd5185f374bd403ccb8d7788c6c13f8": "6f0047cef4b00d96e042697ad3406039",
".git/objects/1c/47109a767e91e994f53fa228f018d7e0d7c4d4": "0c7535cf56b41cd3cd55e20518f316b3",
".git/objects/14/edddbc4bba20c1751bee240620e97b44988bff": "7ef9ab851c57cbfeda64af1aae79b7f3",
".git/HEAD": "4cf2d64e44205fe628ddd534e1151b58",
".git/info/exclude": "036208b4a1ab4a235d75c181e685e5a3",
".git/logs/HEAD": "f6d2daecd4981c90e258d64559d77453",
".git/logs/refs/heads/master": "f6d2daecd4981c90e258d64559d77453",
".git/logs/refs/remotes/origin/HEAD": "cdec42c7b1976dca5d998d4516ba7cff",
".git/logs/refs/remotes/origin/master": "54771b0c057f8fa2026d19056a36f4ff",
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
".git/refs/heads/master": "7107553d5a4ba556f30d9b01983639be",
".git/refs/remotes/origin/HEAD": "73a00957034783b7b5c8294c54cd3e12",
".git/refs/remotes/origin/master": "7107553d5a4ba556f30d9b01983639be",
".git/index": "3723f4aee3df2469ce9dd3e8f2a48a98",
".git/packed-refs": "dc8b4b001a60d6cb79670a5b83c18751",
".git/COMMIT_EDITMSG": "e34d2b248b90575187875b8457a228be",
"assets/AssetManifest.json": "355836fdaf92f49c07209cd4f2a805bf",
"assets/NOTICES": "549a20b666d59c11f17af68c5d5b6ef7",
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
"canvaskit/skwasm.js.symbols": "741d50ffba71f89345996b0aa8426af8",
"canvaskit/canvaskit.js.symbols": "38cba9233b92472a36ff011dc21c2c9f",
"canvaskit/skwasm.wasm": "e42815763c5d05bba43f9d0337fa7d84",
"canvaskit/chromium/canvaskit.js.symbols": "4525682ef039faeb11f24f37436dca06",
"canvaskit/chromium/canvaskit.js": "43787ac5098c648979c27c13c6f804c3",
"canvaskit/chromium/canvaskit.wasm": "f5934e694f12929ed56a671617acd254",
"canvaskit/canvaskit.js": "c86fbd9e7b17accae76e5ad116583dc4",
"canvaskit/canvaskit.wasm": "3d2a2d663e8c5111ac61a46367f751ac",
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
