export const desktopDistributionName = "stickvania-desktop";

export const desktopRuntimeJars = [
    {
        path: "lib/slick.jar",
        sha256: "02f7a1f0c48847a32fcc1a3330b12b869e73ad7658c7708174d9f1f2ec75847b"
    },
    {
        path: "lib/lwjgl.jar",
        sha256: "a31267bf348e564217d833cb0b334cfe4062aab12b015c126f323882949d1c1d"
    },
    {
        path: "lib/lwjgl_util.jar",
        sha256: "2432cbacfcec9cd78165f44f45d045bafff9da122276ed288157699eeee688de"
    },
    {
        path: "lib/jinput.jar",
        sha256: "36b6fbede7a2d2f00949a87b9de83007a1c6b4ce5a96978279c0cc612a9adef5"
    },
    {
        path: "lib/jogg-0.0.7.jar",
        sha256: "2e2744b9bfada5e62ba274d6b3089656676599afacc095647234ae383b991ecc"
    },
    {
        path: "lib/jorbis-0.0.17.jar",
        sha256: "7096b7eef82228c7aea0260fac4884aec416b332dfaac8182dea8c28ba35b45f"
    }
];

export const desktopRuntimeNatives = [
    {
        path: "natives/windows/lwjgl.dll",
        sha256: "60377a953f707aab277410c5fec00224ffa1b861838b657e5916247cfb151453"
    },
    {
        path: "natives/windows/lwjgl64.dll",
        sha256: "5520eab49c484495a46f04974ee8815477a1c46f0c7b01739eb3a93d863d541a"
    },
    {
        path: "natives/windows/jinput-dx8.dll",
        sha256: "f6ee33701bfbba481870f4a370d707b87001fb3213efcc60bff325013b4e219c"
    },
    {
        path: "natives/windows/jinput-dx8_64.dll",
        sha256: "511dc50c2001d3e25845dd479ca82fdfc9d42403f9aa69c6493257c66ddf0266"
    },
    {
        path: "natives/windows/jinput-raw.dll",
        sha256: "0fcd33e00ba5c51f3fdf3613d89c6e9e00381fef03b550412ea73bc837237dcf"
    },
    {
        path: "natives/windows/jinput-raw_64.dll",
        sha256: "74cd74d55ea20e8fcea7aed8b97c2cf096da1fcde3faf183f815a4dce9364ec3"
    },
    {
        path: "natives/windows/OpenAL32.dll",
        sha256: "af7fbb5f60b3e63577d4567ba58df6ede48a7705658c9de6a322d02dde0759b8"
    },
    {
        path: "natives/windows/OpenAL64.dll",
        sha256: "3ebc1009680b0e04f4b99b54a0e7b768c14603bf5e8080255aa82a01a269b92b"
    },
    {
        path: "natives/linux/liblwjgl.so",
        sha256: "e0de8f9c34e777578dea80d43ca0b61b16f4edb9d3b2ba8ce52c4d4dd2325f33"
    },
    {
        path: "natives/linux/liblwjgl64.so",
        sha256: "a448d44fc012e20bef022ece083070ead143fa37daedbc570872d42da11e4189"
    },
    {
        path: "natives/linux/libjinput-linux.so",
        sha256: "ff7af7a1306451428c98e3f50c5bf2f19bb6cbc5835730917cdd755b8cc626d0"
    },
    {
        path: "natives/linux/libjinput-linux64.so",
        sha256: "86e650f47790e789696a7a5809461eb4b503f5f841e17488aa7ee5a1bedc05a6"
    },
    {
        path: "natives/linux/libopenal.so",
        sha256: "0d6511ac012104c470c1fee7311f1459379d1201c796918eb50ae2acecb5801b"
    },
    {
        path: "natives/linux/libopenal64.so",
        sha256: "2a0ee434b0113a61ea98e583787df0de7e082385613d1d94d7c0515a9e301687"
    },
    {
        path: "natives/macosx/liblwjgl.jnilib",
        sha256: "ed4800ba1920a4b4bcf74cf78206e662ccfb0d0bc271f85b7e2c8f80336d43d8"
    },
    {
        path: "natives/macosx/libjinput-osx.jnilib",
        sha256: "d155c29cfa7d7b49cab0821d5ba00a8fdc8b386c8bf5669f0313a62e44ba70d6"
    },
    {
        path: "natives/macosx/openal.dylib",
        sha256: "ff5e52380b5ef5255654c4e61397822cf57598fce5ed5e6d3cde0762b5c837c8"
    }
];

export const desktopRuntimeArtifacts = [...desktopRuntimeJars, ...desktopRuntimeNatives];

export const desktopLicenseFiles = [
    "licenses/GNU-LIBRARY-GPL-2.0.txt",
    "licenses/JINPUT-BSD.txt",
    "licenses/JORBIS-JOGG-LGPL-NOTICE.txt",
    "licenses/LWJGL-2-BSD.txt",
    "licenses/OPENAL-SOFT-LGPL-NOTICE.txt",
    "licenses/README.md",
    "licenses/SLICK2D-BSD-3-CLAUSE.txt"
];

export const desktopThirdPartySourceArtifacts = [
    {
        path: "third-party-sources/jogg-0.0.7-jcraft-jorbis-28592f3-source.zip",
        sha256: "0c814790741d14debc4a88214bdf8d0369a521a652e4d9a375b0cdfdbc21597a"
    },
    {
        path: "third-party-sources/jorbis-0.0.17-sources.jar",
        sha256: "1643dd368b9c160276caf8d1f6a8c0aae43ca5bf49b53348a2a01623641708e5"
    },
    {
        path: "third-party-sources/openal-soft-1.14.tar.bz2",
        sha256: "87bd8d61d5943387898c92b6a2bbbb26118e745dec57550c817526a70fad0914"
    }
];
