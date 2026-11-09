/* Google Identity Services popup, verified by the same-origin account backend. */
(async () => {
  const account = window.wzAccount;
  const box = document.getElementById("google-signin");
  if (!account || !box) return;
  await account.ready;
  let credential = null;
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  const info = document.createElement("p");
  info.className = "support-note";
  info.textContent = account.me
    ? "Link Google to this account to keep your messages and saved AI history."
    : "Already have a Wezzet account? Sign in above first, then link Google to keep your messages and history.";
  const launch = document.createElement("button");
  launch.type = "button";
  launch.className = "btn btn-quiet";
  launch.textContent = account.me
    ? "Link Google to this account"
    : "Use Google to sign in";
  const target = document.createElement("div");
  const signup = document.createElement("form");
  signup.hidden = true;
  const label = document.createElement("label");
  const age = document.createElement("input");
  age.type = "checkbox";
  age.required = true;
  label.append(age, " I am 13 or older.");
  const create = document.createElement("button");
  create.type = "submit";
  create.className = "btn";
  create.textContent = "Create my Wezzet account";
  signup.append(label, create);
  box.replaceChildren(info, launch, target, status, signup);
  let busy = false;
  async function complete(age13 = false) {
    if (busy) return;
    busy = true;
    create.disabled = true;
    status.textContent = "Verifying your Google account…";
    const result = await account.call("google", {
      method: "POST",
      body: JSON.stringify({ credential, age13 }),
    });
    busy = false;
    create.disabled = false;
    if (result.error) {
      status.textContent = result.error;
      return;
    }
    if (result.needsSignup) {
      signup.hidden = false;
      status.textContent =
        "Create a Wezzet account with this Google login. You can change your public username in Chat.";
      age.focus();
      return;
    }
    credential = null;
    location.reload();
  }
  signup.onsubmit = (event) => {
    event.preventDefault();
    if (age.checked) complete(true);
  };
  launch.onclick = async () => {
    launch.disabled = true;
    status.textContent = "Loading Google sign-in…";
    try {
      const result = await account.call("google/start", {
        method: "POST",
        body: JSON.stringify({ link: !!account.me }),
      });
      if (result.error) throw new Error(result.error);
      if (!window.google?.accounts?.id) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://accounts.google.com/gsi/client";
          script.async = true;
          script.onload = resolve;
          script.onerror = () =>
            reject(
              new Error(
                "Google could not load. Check your connection or use your Wezzet login.",
              ),
            );
          document.head.append(script);
        });
      }
      google.accounts.id.initialize({
        client_id: result.clientId,
        nonce: result.nonce,
        ux_mode: "popup",
        auto_select: false,
        callback: (response) => {
          credential = response.credential;
          complete();
        },
      });
      google.accounts.id.renderButton(target, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        width: 280,
      });
      launch.hidden = true;
      status.textContent = "Choose your Google account to continue.";
    } catch (error) {
      status.textContent = error.message;
      launch.disabled = false;
    }
  };
  // A password login/logout changes whether this action signs in or links an account.
  document.addEventListener("wz-account", () => location.reload());
})();
