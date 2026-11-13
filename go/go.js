// Campaign redirect for BoardBound Prep. One folder per channel: /go/<channel>/.
// Apple attributes with pt (provider token) + ct (campaign); Google Play with a UTM referrer.
// shortcut: PT is blank until read from App Store Connect (App Analytics > Campaigns); until then
// iOS clicks land on the store without attribution, Android clicks are still attributed.
(function () {
  var PT = "";
  var APP_ID = "6761675393";
  var PKG = "com.boardbound.app";
  var ch = (document.documentElement.getAttribute("data-channel") || "site").replace(/[^a-z0-9-]/g, "");
  var ios = "https://apps.apple.com/app/apple-store/id" + APP_ID + "?" + (PT ? "pt=" + PT + "&" : "") + "ct=" + ch + "&mt=8";
  var play = "https://play.google.com/store/apps/details?id=" + PKG + "&referrer=" +
    encodeURIComponent("utm_source=" + ch + "&utm_medium=referral&utm_campaign=winter2026");
  document.getElementById("ios").href = ios;
  document.getElementById("play").href = play;
  var ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) location.replace(ios);
  else if (/Android/.test(ua)) location.replace(play);
})();
