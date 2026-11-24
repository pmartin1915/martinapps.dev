// Campaign redirect for BoardBound Prep. One folder per channel: /go/<channel>/.
// Apple attributes with pt (provider token) + ct (campaign); Google Play with a UTM referrer.
// PT: provider token from App Store Connect > Analytics > Campaigns (read 2026-11-24).
(function () {
  var PT = "128659939";
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
