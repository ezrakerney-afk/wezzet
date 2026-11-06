(() => {
  const $ = (i) => document.getElementById(i);
  const out = ["bmr", "keep", "lose", "gain"];
  const fmt = (n) => Math.round(n).toLocaleString() + " kcal";
  const go = () => {
    const us = document.querySelector("input[name=u]:checked").value === "us";
    const male = document.querySelector("input[name=s]:checked").value === "m";
    const a = +$("a").value, w0 = +$("w").value, h0 = +$("h").value;
    if (!a || !w0 || !h0) { out.forEach((k) => ($(k).textContent = "-")); return; }
    const w = us ? w0 * 0.45359237 : w0, h = us ? h0 * 2.54 : h0;
    const bmr = 10 * w + 6.25 * h - 5 * a + (male ? 5 : -161);
    const keep = bmr * +$("act").value;
    $("bmr").textContent = fmt(bmr);
    $("keep").textContent = fmt(keep);
    $("lose").textContent = fmt(Math.max(keep - 500, male ? 1500 : 1200));
    $("gain").textContent = fmt(keep + 500);
  };
  document.querySelectorAll("input,select").forEach((i) => { i.addEventListener("input", go); i.addEventListener("change", go); });
})();
