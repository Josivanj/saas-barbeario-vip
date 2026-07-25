const menuButton = document.getElementById("menuButton");
const navigation = document.getElementById("navigation");
const header = document.querySelector(".header");
const currentYear = document.getElementById("currentYear");

if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
}

if (menuButton && navigation) {
    menuButton.addEventListener("click", () => {
        navigation.classList.toggle("active");

        const menuIsOpen = navigation.classList.contains("active");

        menuButton.innerHTML = menuIsOpen
            ? '<i class="fa-solid fa-xmark"></i>'
            : '<i class="fa-solid fa-bars"></i>';
    });
}

document.querySelectorAll(".navigation a").forEach((link) => {
    link.addEventListener("click", () => {
        navigation?.classList.remove("active");

        if (menuButton) {
            menuButton.innerHTML = '<i class="fa-solid fa-bars"></i>';
        }
    });
});

window.addEventListener("scroll", () => {
    if (!header) {
        return;
    }

    header.classList.toggle("scrolled", window.scrollY > 30);
});