// Get the canvas element and its 2D rendering context
const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');

// Array to hold our particles
const particles = [];

// Configuration for particles
const particleCount = 100; // Number of particles
const maxParticleSize = 3; // Maximum radius of a particle
const minParticleSize = 0.5; // Minimum radius
const particleSpeed = 0.5; // How fast particles move

// Mouse object for interactivity
const mouse = {
    x: undefined,
    y: undefined,
    radius: 100 // Area around mouse where particles react
};

// Update mouse position on mouse move
window.addEventListener('mousemove', (event) => {
    mouse.x = event.x;
    mouse.y = event.y;
});

// Reset mouse position when mouse leaves the window
window.addEventListener('mouseout', () => {
    mouse.x = undefined;
    mouse.y = undefined;
});

// Helper to get computed style of a CSS variable
function getCssVariable(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Particle class to create individual particles
class Particle {
    constructor(x, y, directionX, directionY, size, color) {
        this.x = x;
        this.y = y;
        this.directionX = directionX;
        this.directionY = directionY;
        this.size = size;
        this.color = color;
    }

    // Method to draw individual particle
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.fill();
    }

    // Method to update particle's position and handle collision/interactivity
    update() {
        // Reverse direction if particle hits canvas boundaries
        if (this.x + this.size > canvas.width || this.x - this.size < 0) {
            this.directionX = -this.directionX;
        }
        if (this.y + this.size > canvas.height || this.y - this.size < 0) {
            this.directionY = -this.directionY;
        }

        this.x += this.directionX;
        this.y += this.directionY;

        // Mouse interactivity: Shrink particles near mouse, push them away
        if (mouse.x !== undefined && mouse.y !== undefined) {
            let dx = mouse.x - this.x;
            let dy = mouse.y - this.y;
            let distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < mouse.radius + this.size) {
                if (this.size > minParticleSize) {
                    this.size -= 0.1; // Slightly shrink
                }
            } else if (this.size < maxParticleSize) {
                this.size += 0.05; // Grow back to original size
            }
        } else if (this.size < maxParticleSize) {
            this.size += 0.05; // Grow back if mouse is gone
        }

        this.draw();
    }
}

// Function to initialize particles based on theme
function initParticles() {
    particles.length = 0; // Clear existing particles

    // Determine particle color based on current theme
    const currentTheme = document.body.dataset.theme;
    let particleBaseColor;
    if (currentTheme === 'dark') {
        // For dark mode, use a translucent white/light color
        particleBaseColor = '255, 255, 255';
    } else {
        // For light mode, use a translucent dark grey/blue from the theme's text color
        // Using a slightly lighter version of --text or directly defining a dark subtle color
        // Example: '52, 73, 94' from --text or a softer '100, 100, 100' for light grey
        particleBaseColor = '100, 100, 100'; // A subtle dark grey for light mode
    }

    for (let i = 0; i < particleCount; i++) {
        let size = Math.random() * (maxParticleSize - minParticleSize) + minParticleSize;
        let x = Math.random() * (canvas.width - size * 2) + size;
        let y = Math.random() * (canvas.height - size * 2) + size;
        let directionX = (Math.random() * particleSpeed * 2) - particleSpeed; // -0.5 to 0.5
        let directionY = (Math.random() * particleSpeed * 2) - particleSpeed; // -0.5 to 0.5
        let color = `rgba(${particleBaseColor}, ${ (Math.random() * 0.7 + 0.3).toFixed(2) })`; // Random opacity for subtle glow

        particles.push(new Particle(x, y, directionX, directionY, size, color));
    }
}

// Animation loop
function animateParticles() {
    // Clear canvas for next frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
    }

    requestAnimationFrame(animateParticles);
}

// Set canvas dimensions and start animation on window load/resize
function setCanvasDimensions() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initParticles(); // Reinitialize particles on resize (to update color if theme changed)
}

// Event listeners
window.addEventListener('load', () => {
    setCanvasDimensions();
    animateParticles();
});

// Also re-initialize particles if the theme changes via button/system preference
document.body.addEventListener('transitionend', (event) => {
    // Check if the transition was on the body's background-color or color property
    // This is a heuristic to detect theme changes if not explicitly triggered by button click
    if (event.propertyName === 'background-color' || event.propertyName === 'color') {
        initParticles(); // Reinitialize particles to update their color based on new theme
    }
});

window.addEventListener('resize', setCanvasDimensions);
