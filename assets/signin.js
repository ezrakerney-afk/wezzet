window.wzAccount.ready.then(() => {
  if (window.wzAccount.me) return;
  const box = document.getElementById("wz-account");
  box.querySelector('input[type="text"]').setAttribute("aria-label", "Login name");
  box.querySelector('input[type="password"]').setAttribute("aria-label", "Password");
  box.querySelector("button")?.click();
});
