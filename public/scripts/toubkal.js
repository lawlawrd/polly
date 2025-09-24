gsap.registerPlugin(MorphSVGPlugin);

document.addEventListener("DOMContentLoaded", (event) => {
  const morphElements = ["outline", "l1-", "a1-", "w1-", "l2-", "a2-", "w2-"];
  const morphSettings = {
    duration: 0.3,
    delay: 10,
    ease: "power3.inOut",
  };

  for (const morphEl of morphElements) {
    let tl = gsap.timeline({
      repeat: -1,
    });

    tl.to("#" + morphEl + "1", {
      ...morphSettings,
      morphSVG: "#" + morphEl + "2",
    })
      .to("#" + morphEl + "1", {
        ...morphSettings,
        morphSVG: "#" + morphEl + "3",
      })
      .to("#" + morphEl + "1", {
        ...morphSettings,
        morphSVG: "#" + morphEl + "4",
      })
      .to("#" + morphEl + "1", {
        ...morphSettings,
        morphSVG: "#" + morphEl + "1",
      });
  }
});
