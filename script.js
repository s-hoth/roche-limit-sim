const canvas = document.getElementById("simulation");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

function randomColor() {
    return '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
}

class Planet {
    static AU = 149.6e6 * 1000;
    static G = 6.67428e-11;
    static SCALE = 250 / Planet.AU;
    static TIMESTEP = 3600 * 6;

    constructor(x, y, radius, color, mass, sun = false) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.mass = mass;
        this.sun = sun;

        this.x_vel = 0;
        this.y_vel = 0;
        this.orbit = [];
        this.distance_to_sun = 0;
        this.isDragging = false;

        this.breaking = false;
        this.breakTimer = 0;
        this.inRoche = false;
    }

    draw() {
        const x = this.x * Planet.SCALE + canvas.width / 2;
        const y = this.y * Planet.SCALE + canvas.height / 2;

        if (this.orbit.length > 1) {
            ctx.beginPath();
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2;
            for (let i = 0; i < this.orbit.length; i++) {
                const [ox, oy] = this.orbit[i];
                const px = ox * Planet.SCALE + canvas.width / 2;
                const py = oy * Planet.SCALE + canvas.height / 2;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.fillStyle = this.color;
        if (this.breaking && !this.sun) {
            const dx = this.x - sun.x;
            const dy = this.y - sun.y;
            const angle = Math.atan2(dy, dx);
            const stretch = 1 + 0.5 * Math.sin(this.breakTimer / 5);

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);
            ctx.scale(stretch, 1 / stretch);
            ctx.arc(0, 0, Math.max(this.radius, 0), 0, Math.PI * 2);
            ctx.restore();
        } else {
            ctx.arc(x, y, this.radius, 0, Math.PI * 2);
        }
        ctx.fill();

        if (!this.sun) {
            ctx.fillStyle = "white";
            ctx.font = "16px Arial";
            ctx.fillText(`${Math.round(this.distance_to_sun / 1000)} km`, x - 30, y - 10);
        }

        if (this.isDragging) {
            const dx = this.x - sun.x;
            const dy = this.y - sun.y;
            let vx = -dy;
            let vy = dx;
            const mag = Math.sqrt(vx * vx + vy * vy);
            vx /= mag;
            vy /= mag;
            const screenLength = 100;
            vx *= screenLength;
            vy *= screenLength;

            ctx.beginPath();
            ctx.strokeStyle = "lime";
            ctx.lineWidth = 2;
            ctx.moveTo(x, y);
            ctx.lineTo(x + vx, y + vy);
            ctx.stroke();
        }
    }

    attraction(other) {
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (other.sun) this.distance_to_sun = distance;

        const force = Planet.G * this.mass * other.mass / (distance * distance);
        const theta = Math.atan2(dy, dx);

        return [Math.cos(theta) * force, Math.sin(theta) * force];
    }

    updatePosition(planets) {
        if (this.isDragging) return;

        let total_fx = 0;
        let total_fy = 0;

        for (let planet of planets) {
            if (planet === this) continue;
            const [fx, fy] = this.attraction(planet);
            total_fx += fx;
            total_fy += fy;
        }

        this.x_vel += total_fx / this.mass * Planet.TIMESTEP;
        this.y_vel += total_fy / this.mass * Planet.TIMESTEP;

        this.x += this.x_vel * Planet.TIMESTEP;
        this.y += this.y_vel * Planet.TIMESTEP;

        this.orbit.push([this.x, this.y]);
        if (this.orbit.length > 3000) this.orbit.shift();
    }
}

class Fragment {
    constructor(x, y, vx, vy, radius, color) {
        this.x = x;
        this.y = y;
        this.x_vel = vx;
        this.y_vel = vy;
        this.radius = radius;
        this.color = color;
        this.life = 200;
        this.mass = radius * 1e22;
        this.ringTrail = [[x, y]];
    }

    updatePosition() {
        const dx = sun.x - this.x;
        const dy = sun.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const force = Planet.G * this.mass * sun.mass / (dist * dist);
        const angleToSun = Math.atan2(dy, dx);
        const angle = angleToSun + (Math.random() - 0.5) * Math.PI / 12;
        const fx = Math.cos(angle) * force;
        const fy = Math.sin(angle) * force;

        this.x_vel += fx / this.mass * Planet.TIMESTEP;
        this.y_vel += fy / this.mass * Planet.TIMESTEP;

        this.x += this.x_vel * Planet.TIMESTEP;
        this.y += this.y_vel * Planet.TIMESTEP;

        this.ringTrail.push([this.x, this.y]);
        if (this.ringTrail.length > 500) this.ringTrail.shift();

        this.radius *= 0.995;
        this.life -= 1;
    }

    draw() {
        const x = this.x * Planet.SCALE + canvas.width / 2;
        const y = this.y * Planet.SCALE + canvas.height / 2;

        if (this.ringTrail.length > 1) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(${this.hexToRGB(this.color)},0.03)`;
            ctx.lineWidth = 2;
            for (let i = 0; i < this.ringTrail.length; i++) {
                const [ox, oy] = this.ringTrail[i];
                const px = ox * Planet.SCALE + canvas.width / 2;
                const py = oy * Planet.SCALE + canvas.height / 2;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.fillStyle = `rgba(${this.hexToRGB(this.color)},${this.life / 200})`;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 5;
        ctx.arc(x, y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    hexToRGB(hex) {
        let c;
        if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
            c = hex.substring(1).split('');
            if (c.length == 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
            c = '0x' + c.join('');
            return [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',');
        }
        return "255,255,255";
    }
}

// central sun / planetary body
const sun = new Planet(0, 0, 30, randomColor(), 1.98892e30, true);

let planets = [sun];
const rocheLimit = 0.5 * Planet.AU;

// spawn 4-5 planets outside Roche limit in random 2D positions
const planetCount = 4 + Math.floor(Math.random()*2);
for (let i = 0; i < planetCount; i++) {
    const minDist = rocheLimit + 0.05*Planet.AU;
    const maxDist = 1.8 * Planet.AU;
    const dist = minDist + Math.random() * (maxDist - minDist);
    const angle = Math.random() * Math.PI * 2;
    const x = dist * Math.cos(angle);
    const y = dist * Math.sin(angle);

    const radius = 8 + Math.random()*12;
    const mass = 3e23 + Math.random()*1e24;

    const p = new Planet(x, y, radius, randomColor(), mass);

    // velocity vector
    const speed = Math.sqrt(Planet.G * sun.mass / dist);
    const vx = -speed * Math.sin(angle);
    const vy = speed * Math.cos(angle);
    p.x_vel = vx;
    p.y_vel = vy;

    planets.push(p);
}

let fragments = [];
let selectedPlanet = null;

// drag & drop
canvas.addEventListener("mousedown", (e) => {
    const mx = (e.clientX - canvas.width / 2) / Planet.SCALE;
    const my = (e.clientY - canvas.height / 2) / Planet.SCALE;

    for (let planet of planets) {
        if (planet.sun) continue;
        const dx = mx - planet.x;
        const dy = my - planet.y;
        if (Math.sqrt(dx * dx + dy * dy) < planet.radius / Planet.SCALE) {
            selectedPlanet = planet;
            planet.isDragging = true;
            planet.orbit = [[mx, my]];
            planet.x_vel = 0;
            planet.y_vel = 0;
            break;
        }
    }
});

canvas.addEventListener("mousemove", (e) => {
    if (!selectedPlanet) return;
    selectedPlanet.x = (e.clientX - canvas.width / 2) / Planet.SCALE;
    selectedPlanet.y = (e.clientY - canvas.height / 2) / Planet.SCALE;
    selectedPlanet.orbit = [[selectedPlanet.x, selectedPlanet.y]];
});

canvas.addEventListener("mouseup", () => {
    if (!selectedPlanet) return;
    selectedPlanet.isDragging = false;

    const dx = selectedPlanet.x - sun.x;
    const dy = selectedPlanet.y - sun.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const speed = Math.sqrt(Planet.G * sun.mass / dist);
    const angle = Math.atan2(dy, dx);
    selectedPlanet.x_vel = -speed * Math.sin(angle);
    selectedPlanet.y_vel = speed * Math.cos(angle);

    if (dist < rocheLimit) {
        selectedPlanet.inRoche = true;
        selectedPlanet.breaking = true;
    }

    selectedPlanet = null;
});

// animation loop
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // roche limit circle
    ctx.beginPath();
    ctx.strokeStyle = "white";
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 2;
    ctx.arc(canvas.width / 2, canvas.height / 2, rocheLimit * Planet.SCALE, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    planets = planets.filter(planet => {
        if (!planet.sun && planet.breaking && planet.inRoche) {
            planet.breakTimer++;
            planet.radius -= 0.2;

            for (let i = 0; i < 5; i++) {
                const dx = sun.x - planet.x;
                const dy = sun.y - planet.y;
                const angleToSun = Math.atan2(dy, dx);
                const angle = angleToSun + (Math.random() - 0.5) * Math.PI / 12;
                const speed = (Math.random() * 0.3 + 0.3) * Math.sqrt(Planet.G * sun.mass / planet.distance_to_sun);

                fragments.push(new Fragment(
                    planet.x,
                    planet.y,
                    planet.x_vel + Math.cos(angle) * speed,
                    planet.y_vel + Math.sin(angle) * speed,
                    planet.radius / 2,
                    planet.color
                ));
            }

            if (planet.radius <= 0) return false;
        }

        planet.updatePosition(planets);
        planet.draw();
        return true;
    });

    fragments = fragments.filter(f => f.life > 0 && f.radius > 0);
    fragments.forEach(f => { f.updatePosition(); f.draw(); });

    requestAnimationFrame(animate);
}

animate();
