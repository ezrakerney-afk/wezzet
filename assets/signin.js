window.wzAccount.ready.then(() => {
  if (!window.wzAccount.me) document.querySelector("#wz-account button")?.click();
});
