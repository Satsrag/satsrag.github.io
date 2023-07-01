'use strict';
const MANIFEST = 'flutter-app-manifest';
const TEMP = 'flutter-temp-cache';
const CACHE_NAME = 'flutter-app-cache';

const RESOURCES = {"version.json": "1e98a4f7390d2e9d9ad60c99fb0aff05",
"index.html": "70dcca3f421a3834827b9b76bc50bf78",
"/": "d56cebee6f4b2e02b9e4b170dc658e3c",
"main.dart.js": "172aeeb0abd38da7b2fe78932cc3146a",
"sqlite3.wasm": "91f3e6deef838b810d9ee3c8cc750eba",
"flutter.js": "6fef97aeca90b426343ba6c5c9dc5d4a",
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
".git/objects/0d/3f77c5a62caf769f68c03c47bb78b363da0b3d": "21c058c51792cca2c6cb60361355f7ed",
".git/objects/66/5ad4f2910ad816efc15dbdd1d0b296c193cd03": "689a90515524ac05e76f8809d81da0b4",
".git/objects/66/c88ee439491b42700ca44135381022e77566ff": "df27b68c555b9d8d1bd3544fed75ee96",
".git/objects/68/5580bab38a6b8157698cddb111ff03dc33b006": "579e945fd7bd3cb75e572b75d2cd6f05",
".git/objects/57/969880416c5432ee579b4096bae4f1b38a5965": "acb969565579fa7c0bf8b64400af04a8",
".git/objects/6f/a9fea278aeb2a4381f9eb1156e89c80b6dc292": "52733905ce633aca0433d75a74323bd2",
".git/objects/03/c531a7a4eadfbb97e5434401927ee31890cf33": "fe6b24f60048b7f218835d95c2c650ae",
".git/objects/6a/e9513f9bdb87456a9cb2131636716b38c8911c": "d2210f548583c721f56b54f33d35a1bd",
".git/objects/6a/562868741911ffc3a5345f3c094a71eb0d073d": "ad3237b80e6dc65be0e2000c6c0a445f",
".git/objects/35/91af41948adc8001f3586d76b91181311953fc": "c91d33b29071dcff3b2b3385383761cb",
".git/objects/56/c80d67d5c91f41eb39eeda495d28b80e14a0c3": "09319a1c06107df8842535cd00870e0c",
".git/objects/51/34e6402246228fb7f58ce8fe76727a61d99a62": "6b5e5b48febe40daec7062aecdc3b39f",
".git/objects/58/9de0351df3a4ad669834cb64b43f579ccfe89d": "20c51b6edd544711307557353a2d99cb",
".git/objects/67/d8babf9922186f2ec1428db837f1e0d3d41a1f": "a876a4176698d57d866dc853eaa3d3d2",
".git/objects/0b/85bcdb86bf9e9f9fda81b13cec9c9349d47d77": "77cbf4b6cc88e2471afd14a98ef2e0ed",
".git/objects/0e/d34717d9863dd39abca316c556c77e5f62de60": "45f0965229ed3b8f2576223ba3ac0793",
".git/objects/60/f457c406de81037d3bd756d1f562cb60dd3e90": "de0a9a3cc819e5ed797014ce79218bf7",
".git/objects/60/3599e1aa61a239ad393eeb21a0194c49e485a6": "a7980b01604ead5cdfa443e316685457",
".git/objects/9d/068d2305c8c2d532f59d77d321c18274aa151e": "efa50597e0a1e98884421d00deb6b934",
".git/objects/a3/036ac46d0232f00d6b5245567bc0f375fa7237": "33d56e3556954b1bb35b8818323b58ab",
".git/objects/b2/2fdb2d1fa6a3bced274617d58f6ab432bb0d8b": "1b405e4dfab487f51d41422d52600614",
".git/objects/b2/788b10c682f2ac026915496f701b7e318b42f2": "7c4cb118987ed51347872c29b920d411",
".git/objects/ac/5dc9e3c29fcd5ebbeb8e5f45b471172d711247": "8da74fb2ce87c872210f869ea41caae5",
".git/objects/ad/b6173badf9d076bf588f962e95ed41846bf5f1": "cb0427debd51faeb66401ab6424dd103",
".git/objects/bb/b7ddce5a47b6d1ca290a7925390da8f54c73de": "72597a4f4b5795dcb673d3b093d4c5dd",
".git/objects/bb/ac29f5ef7a40bf14c0901bc1457724156bc0de": "1393f20f0610cabefe2d4f45865b0f54",
".git/objects/d7/f0a72ba79242ad12a328f545da5ba0ad59f57e": "7acae7c3984d147ba7ef41da92aeb0c2",
".git/objects/be/121cc7c416729817b180a93cfe38470e3844ca": "434c8103bad75fd6299eb4239d7fb665",
".git/objects/be/3a1e20e7d00374421514a3dbad3c0d88c8a577": "f96ef786ea0d259331326a28cc288503",
".git/objects/df/8f7bdbab142a3378227acb341e50239a5dda48": "a3e791e017a0ba5fbebb9b1fd245c78a",
".git/objects/bd/cf0a4d61538c47ecc012757ebb9562e936d1e8": "007c9f66e7aa6b9eb36ef1bbad492b2a",
".git/objects/d1/34ed87ad2543ab75eeac0e598cbae3042fafa5": "029df57bb242688d7e93e59ea25d38b8",
".git/objects/d6/9c56691fbdb0b7efa65097c7cc1edac12a6d3e": "868ce37a3a78b0606713733248a2f579",
".git/objects/ae/37803d1933c3979fd1b939ff61cc667b0b70dc": "f5c08c98e82ebd9034dbd78b64a292fa",
".git/objects/d8/7eda5a8d8758efc84cb6cbfbb5dc087f0b17f8": "2c47adb76dc0c7ccbab7d6a25a47f90e",
".git/objects/ab/0e98497a51ead7821d1da35a24968ff314e50f": "557c35fe3928eb2af403d1b3926bb9ba",
".git/objects/ab/d3956c3a25d7cc72131a8a5a9ab86a9c496ed9": "32f36c6b67b8ea68213aa5d657b74bac",
".git/objects/e5/951dfb943474a56e611d9923405cd06c2dd28d": "c6fa51103d8db5478e1a43a661f6c68d",
".git/objects/f4/398ae188972c2cacfc450a12f1c828e3e63767": "3f2237219575afdf49e120d22f67849b",
".git/objects/f4/ee528684cff7cb30d23811fbbe2b35f2e0e101": "af65617c41f7cfbf030e1ebde3053b3b",
".git/objects/eb/9b4d76e525556d5d89141648c724331630325d": "37c0954235cbe27c4d93e74fe9a578ef",
".git/objects/eb/564f3ffc48ffac053de98f0054e4443bda2eaa": "1f28d9d5bfb40c3255a4fda31a88be1b",
".git/objects/f5/8bac554a34625f6d633269359265a73db5afe9": "dab572a4779e46d7a142b29f9e464c9c",
".git/objects/e3/e42b54270cd11fce6d0f86066fad99a7ea7d56": "91ea3036be1326e06c1aeb2834837a88",
".git/objects/ca/52f88a8185d05d9f6044b1f0817187d396ae2a": "1f57640c993e7a3ea4d5cff3e99b35f8",
".git/objects/c8/9ce95aea471b49834b9376eb19319b52580c28": "d433599d838163eef94aaa9fc0e6ce9a",
".git/objects/fb/3f6c71e7d3719b58bbaa4e8db1d18b936cd6c3": "72d314293a5ad5ff2c83df560d4cc859",
".git/objects/c6/680343cfa440ea026aa40bc79c8e427327287a": "574070a2e09231e98b159673b65d4ff9",
".git/objects/c6/fdf53bd4992f39750136572db9c6d30a2d1c5e": "6eb185d2ba765779343612e270f5fbae",
".git/objects/20/60c37646c509211fca0c74ccefd91aa3677090": "2e045c58ea417fcec97e30e8366637f9",
".git/objects/20/3f54aef75693e3190aeabc586810f6dda42ac8": "4bc782739e65bb508feac1d568d5ff6e",
".git/objects/18/cd2dca732779573af2b311f81065906e1062a5": "561bb547ecffe6c498b300cabb9a8eb2",
".git/objects/27/d9c7c411eca6d984dedd8a193470f8a61153ae": "8fdd723b048b02b27c20b820abacde66",
".git/objects/4b/ce11f832f26ee264d95b6790237601cf5a6088": "d9243641979aa81a886b057ab392745a",
".git/objects/pack/pack-bd5af4765291840c77afca83711a716377dc898f.pack": "b7ca2097d3099fa6829c7af90d98a87c",
".git/objects/pack/pack-bd5af4765291840c77afca83711a716377dc898f.idx": "f8853f85365c93814c197c53c2dbf379",
".git/objects/7c/d5ff8779d194df2b7aa723119d94e5387f9e84": "1fd989dc741b4efafe8e2391670869c8",
".git/objects/7c/1c0a136ee0a50811ee78207a9e34291322b94c": "3a61e7bce9b966c5d822b874f1876159",
".git/objects/73/a5ca9e6ea457a8e87e3e88047b9268f15bb75b": "437e873491b95548ba60fecc00fa7933",
".git/objects/28/d545196c047ea98a2ea1bfedd5f226ac1ae5ec": "7d18fe4630d1c0fd6c7b533f6a065b13",
".git/objects/8a/aa46ac1ae21512746f852a42ba87e4165dfdd1": "1d8820d345e38b30de033aa4b5a23e7b",
".git/objects/19/6817c3c68a9336564d35a440ec24e543a4fbc6": "49d4b11883f9531cb0c8253f7e4f0ba1",
".git/objects/26/cea1ed6560f0e22aa7f7267fb9029edc1fedc5": "c81ebc07a922f042c31d078cfbf1b50c",
".git/objects/4d/d7f0eb97af1bf421d61d8a6a99d38d3aee7025": "d945ed096a26a02addbdae0b9f4a02e3",
".git/objects/72/2df7e213e93c41ddf292d507e843cc3b348b70": "22274db446ae42ba5a7cbde072460932",
".git/objects/44/341504077d6c00b7fee828ed236e2b998f0443": "fc9847266038be514e79201aa95ae8bc",
".git/objects/88/cfd48dff1169879ba46840804b412fe02fefd6": "e42aaae6a4cbfbc9f6326f1fa9e3380c",
".git/objects/9f/c5ef2ce472d910af9409cafc57f36a9ddd2176": "7439faf897fb5dc6fe42fd3543be3b61",
".git/objects/07/7c35555bd23822437ca5236b86d3f5eac8f399": "c373101c6da9dd7b556597049cc4fbd5",
".git/objects/36/ad17644b1b435cf1fa368ea9ebf2236ad9a0fb": "1aa2b9b203965c5ff1662ecf48df751c",
".git/objects/31/d01e6ba4f13ceba7a8dc95162831390f85e758": "7d7c76f08ab54b6273fa339b086b9f2f",
".git/objects/65/6ca6b86337c6f9a8a843e828130118b2712073": "5af8043622c30e5985468f15a4b0b1c9",
".git/objects/62/4ad0489fd9d40511adedd313c2d67ed301c5eb": "b86670b132091f37db998e2be8c66c44",
".git/objects/62/a01d6826913d9efa140d2e9f4bc0f13918e607": "44ba2af6a4f05cb190463143170ae010",
".git/objects/62/411ab4348e66694ea05b2d3ac20a72fbc44f03": "4ba4e6706a028de5f2dbd1bbe5847acb",
".git/objects/37/7580cbf691d03aea79c63a3a251b1b48ac01f1": "c196d282a50e3c372b4445c6b8868297",
".git/objects/37/7ead7488ba04497de54363ee4e4436edf85774": "d08a584d3f7b4fb2a65c159d695456ff",
".git/objects/06/0b8f3c290df3b8639cb2b5cc0de57350056612": "ecf18f9a59d7d601350b71121af64627",
".git/objects/55/919b0b32f21410d9755ffbe64aeb2d07650744": "ffb88073b04c5f9454f1e7f08edc733c",
".git/objects/63/e368837f9a94fc6867f96f9526cb3549307250": "4c0f7dabb7fbec40f3bdadeba8f490c6",
".git/objects/0a/f2cc2be50bd2b5248a54fbf49f92a647a08464": "8332e26f17a21170ad55de091b3e3b21",
".git/objects/0a/65c8c41b201d537c122d743010b0d27f5c6267": "7f0945f857eed779c1f13995ea757892",
".git/objects/d3/a3905962b3428ea9550e1c1ef45a97ec0f154f": "30820a4bd2b719811c7eda0410f6f775",
".git/objects/d3/2f25523b144a00064f3cb6b7ce02eb5f8a8ca7": "314c8d8abdad143b77ba7260901a2e47",
".git/objects/d3/efa7fd80d9d345a1ad0aaa2e690c38f65f4d4e": "610858a6464fa97567f7cce3b11d9508",
".git/objects/d4/2143dd0eba58558cd74369adbf9ac00a7a922a": "61afbb985eaeb58fb1c2de3ee91aa07b",
".git/objects/b8/42d87a06a9bad19db7f6a00adfb59112c8a936": "9c8c91b4ac24c2803b1b3678df9b7528",
".git/objects/b8/31b34fae118ff00984466b168c6f99a6ae66b4": "fae24460882707c2b6ae2f23bfc9f0d1",
".git/objects/aa/f9775aa89c03137dbf48721cdc05191703de5e": "25802b31f0bee36b4e1a7a67835f99f0",
".git/objects/af/106be3d446f0f8d79e50e0170eddd5bb5cfc32": "85039469c495586249cf3e0f579805cf",
".git/objects/b7/49bfef07473333cf1dd31e9eed89862a5d52aa": "36b4020dca303986cad10924774fb5dc",
".git/objects/a8/d1f8b5622ea56726264ff8ffbbf6bffef31ff4": "d569c4db61f7eee1623b45296c4ce0e5",
".git/objects/b9/2a0d854da9a8f73216c4a0ef07a0f0a44e4373": "f62d1eb7f51165e2a6d2ef1921f976f3",
".git/objects/a1/3837a12450aceaa5c8e807c32e781831d67a8f": "bfe4910ea01eb3d69e9520c3b42a0adf",
".git/objects/c4/88b401da094a92d888cf826e517a7c917ddb6c": "518c4439812399b7f54f22c713127162",
".git/objects/f0/623050319e7c383605ca976884a8d108027ceb": "e284be5162dbe1d20ddde617128407cd",
".git/objects/f7/29b95bc41023aadb95ae810bcaaa1fe7433916": "45208899bb7420548c24e880a567055c",
".git/objects/e8/a61b8fb75c222b45b193c91cec4815611e7f48": "3dbdb317bef66b2844f97910894b97a1",
".git/objects/c5/37c8037427b810dd7ddef2bba33b6e965344a0": "4c91a8a7f4d8cd8cbfbc0a4a01ea664d",
".git/objects/c2/dfe1c3066af749361d23c7951b95636d11ac20": "a171c4e7b5c4aaf071229a3ed13ac9e0",
".git/objects/ce/3a26b7a965508394f1129620102c03b135d93a": "9514ff30c00a280544a10b3dbe727bca",
".git/objects/2c/77d3ad18ac341e2be577195032fba8695b3ddf": "5fe1876b09508c8d19c74386ac6c4f1c",
".git/objects/79/8024f98e7ca12e2f9f3c6a24772f61b3c1f95d": "d92b61474f04066343f022511848f86e",
".git/objects/79/ba7ea0836b93b3f178067bcd0a0945dbc26b3f": "f3e31aec622d6cf63f619aa3a6023103",
".git/objects/2d/4157a0ffab2fda0f2a33ca0eaa6a52686b0e27": "50f53dce16b326c3d3b0cdb7665b8939",
".git/objects/2d/a4d2bdfcd27b4ff3fa5c5b6910543a73279527": "5978a8d9c40020342d51806ab273b5be",
".git/objects/2d/ef0022234a338ab8fa016232a6df6e90c48729": "6ff3fe54f7278cffbeb9623eabd71797",
".git/objects/83/cf27dd29c5e3e6d5344bfcdd6004739b881c88": "c4e99f431430d37e85f4921414310d50",
".git/objects/77/088b545f1a5a2fcb8b1a8110a0d988cf0d3048": "065333c7859695e9cb45a22a9adc9f79",
".git/objects/77/4c6e4ca869733f5e7a595431074c3af479beb1": "c6371f285452a6c06de15faf21fe8d7a",
".git/objects/48/c2b7bf16c52b34dba51e8b755cc2190b0eeba0": "ebd9e0b0b476aaf67f850502e8896ece",
".git/objects/1e/bf993c04c08e17a0122730f8d7ce6e139c8bad": "eeb4f0d71f24758335fe1753273ad6c2",
".git/objects/84/7343fe33b0ea597cc7b07e7ce12f4012634b8b": "7dcd08b5bf7f023f4c6211f209242087",
".git/objects/23/ebe5bed95e53a1604fef03b1a4fbbb2da7dc81": "1599b63633ee2965800dfca761cebca3",
".git/objects/23/8a284b959cb9479caae80f374ce077c5e717da": "c173eca53598899ee92bec8d6cd68cc7",
".git/objects/12/5c284dc2bbed823ed6389e50cc75a8a1ef2351": "9ab0bcea773dc4fd6ef989aef459b28a",
".git/objects/8c/99266130a89547b4344f47e08aacad473b14e0": "41375232ceba14f47b99f9d83708cb79",
".git/objects/8c/b18ecf381a79544c1805147d24681583c28ae6": "92b0d6dde6282df6f55d9ab1d255b205",
".git/objects/85/1fbc0d6ba32dced605ebac5ae9be9271a9b43b": "1e2713a9eb61084ff17ce30c28e76098",
".git/objects/1d/384f3748038966a5c7316223edf120dd5894dd": "a8d542276aa823dfefb8d26439e1077a",
".git/objects/49/e90f783e4db70e5936a481fbab9d9f1ea45785": "f5a83a277746bcb931cfe22642d066fa",
".git/objects/40/4a0ef2494ba80e28b17994559924e86afcf3eb": "06b99411bcd1132e53f7377a7cb2c249",
".git/objects/2b/317ce345394b6cac07843c7591f4c96eabae42": "d622a8b423f0bee18028ee400c9393af",
".git/objects/2b/8706b265e4f150178a60fc65aec8bcd7129f5c": "b509e22259865f8827a12bd1599bff4e",
".git/objects/78/0fda01bc2c7df5dfc8d4fe7213ffa82c5702c6": "13d6b0f6dfef72f972076bfba97b8ad4",
".git/objects/8b/3251ae87a48174e7bbcc802e8243297f779cf8": "04ac2546254b729be9b783bab7cf08ca",
".git/objects/8b/215e34d16f3dd5595bac88a4debb5d70c92015": "da29990276b56a7baa995640f222e4d2",
".git/objects/13/53b4ba875badb76791b4049ef0ff5b87064832": "eadfbbb82a06b296ce3f173d3f4fdeb3",
".git/objects/7a/1dc6c70c7b9b402413f08547e7fe491fffad2b": "bee9707ed8d74246289a04d36e7ca0d6",
".git/objects/8e/7f4b338840099949781ab85496d7a67fae46f1": "7f2803c236e9e7d95ef6ed16a3a2bd13",
".git/HEAD": "4cf2d64e44205fe628ddd534e1151b58",
".git/info/exclude": "036208b4a1ab4a235d75c181e685e5a3",
".git/logs/HEAD": "7695faf1e794c1b4c172f42bc458aec8",
".git/logs/refs/heads/master": "7695faf1e794c1b4c172f42bc458aec8",
".git/logs/refs/remotes/origin/HEAD": "3f9cf76bd9835755c1ec4bfe1086ac48",
".git/logs/refs/remotes/origin/master": "d3def6cfd50a51cb538590a2bce2f10a",
".git/description": "a0a7c3fff21f2aea3cfa1d0316dd816c",
".git/hooks/commit-msg.sample": "579a3c1e12a1e74a98169175fb913012",
".git/hooks/pre-rebase.sample": "56e45f2bcbc8226d2b4200f7c46371bf",
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
".git/refs/heads/master": "9b3f283c4579abba58afbd52304267fa",
".git/refs/remotes/origin/HEAD": "73a00957034783b7b5c8294c54cd3e12",
".git/refs/remotes/origin/master": "9b3f283c4579abba58afbd52304267fa",
".git/index": "d2df34b675414b719338d9d4726bb46a",
".git/packed-refs": "cad787cd779a858a5eeebb4c6a87a8d0",
".git/COMMIT_EDITMSG": "74628ff13f55a9627ec243f1cc252914",
"assets/AssetManifest.json": "355836fdaf92f49c07209cd4f2a805bf",
"assets/NOTICES": "b9aa62a4cae603cb75ca31350066a8f8",
"assets/FontManifest.json": "f1b75ad9fa09d24c89fc15f7490c6444",
"assets/packages/zcode_embed_ime_db/sqlite3.wasm": "91f3e6deef838b810d9ee3c8cc750eba",
"assets/packages/zcode_embed_ime_db/db/zcode_ime.db": "0b10c3db6082496c14e0cd14176f347b",
"assets/packages/cupertino_icons/assets/CupertinoIcons.ttf": "57d849d738900cfd590e9adc7e208250",
"assets/packages/menk_embed_ime_db/sqlite3.wasm": "91f3e6deef838b810d9ee3c8cc750eba",
"assets/packages/menk_embed_ime_db/db/menk_ime.db": "3c639319d66df77b42b7c1b53d9bf4ad",
"assets/shaders/ink_sparkle.frag": "f8b80e740d33eb157090be4e995febdf",
"assets/AssetManifest.bin": "e0dab8b666da68a8294a7abb089eb776",
"assets/fonts/MQG8F02.ttf": "a970fff239843a3922452da8568dd6ce",
"assets/fonts/MaterialIcons-Regular.otf": "f2870ee85ba7705c14017e38ddb1128e",
"assets/fonts/z52tsagaantig.ttf": "a3fdb2bc8d915ba3b0ddeaf387f993e7",
"canvaskit/skwasm.js": "1df4d741f441fa1a4d10530ced463ef8",
"canvaskit/skwasm.wasm": "6711032e17bf49924b2b001cef0d3ea3",
"canvaskit/chromium/canvaskit.js": "8c8392ce4a4364cbb240aa09b5652e05",
"canvaskit/chromium/canvaskit.wasm": "fc18c3010856029414b70cae1afc5cd9",
"canvaskit/canvaskit.js": "76f7d822f42397160c5dfc69cbc9b2de",
"canvaskit/profiling/canvaskit.js": "c21852696bc1cc82e8894d851c01921a",
"canvaskit/profiling/canvaskit.wasm": "371bc4e204443b0d5e774d64a046eb99",
"canvaskit/canvaskit.wasm": "f48eaf57cada79163ec6dec7929486ea",
"canvaskit/skwasm.worker.js": "19659053a277272607529ef87acf9d8a"};
// The application shell files that are downloaded before a service worker can
// start.
const CORE = ["main.dart.js",
"index.html",
"assets/AssetManifest.json",
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
