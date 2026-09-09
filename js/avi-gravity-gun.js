/*
 * Avi Edition — Gravity Gun
 * Add-on for n-gon. GPL-compatible derivative code.
 *
 * Primary fire: pull mobs, loose bodies, and powerups toward the aim point.
 * FIELD + FIRE: reverse the field and repel them.
 * Heavy bodies and bosses resist the force.
 */
(() => {
    if (typeof b === "undefined" || !Array.isArray(b.guns)) return;
    if (b.guns.some(g => g && g.name === "gravity gun")) return;

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const dist = (a, c) => Math.hypot(c.x - a.x, c.y - a.y);

    function aimPoint() {
        const range = 850;
        return {
            x: m.pos.x + Math.cos(m.angle) * range,
            y: m.pos.y + Math.sin(m.angle) * range
        };
    }

    function visible(target) {
        if (!target || !target.position) return false;
        try {
            if (Matter.Query.rayAny(map, player.position, target.position)) return false;
            if (typeof body !== "undefined" && Matter.Query.rayAny(body, player.position, target.position)) return false;
        } catch (e) { }
        return true;
    }

    function affect(who, target, reverse) {
        if (!who || !who.position || who === player) return;
        if (who.isInvulnerable || who.isBadTarget || who.isDarkMatter) return;
        if (!visible(who)) return;

        const dx = target.x - who.position.x;
        const dy = target.y - who.position.y;
        const d = Math.hypot(dx, dy);
        if (d < 1 || d > 900) return;

        const ux = dx / d;
        const uy = dy / d;
        const falloff = 1 - clamp(d / 900, 0, 1);
        let strength = 0.0025 * (0.25 + falloff * falloff) * who.mass;

        // Heavy enemies resist the gravity gun; bosses resist much more.
        if (who.isBoss) strength *= 0.22;
        if (who.isFinalBoss) strength *= 0.12;
        strength = Math.min(strength, 0.075 * Math.max(1, who.mass));
        if (reverse) strength *= -1.55;

        who.force.x += ux * strength;
        who.force.y += uy * strength;

        // Give targets near the focal point a short orbital motion.
        if (!reverse && d < 260) {
            const orbit = 0.0011 * who.mass * (1 - d / 260);
            who.force.x += -uy * orbit;
            who.force.y += ux * orbit;
        }

        // A small amount of damage makes a hard slam into the focal point meaningful.
        if (d < 55 && !reverse && typeof m !== "undefined" && m.cycle % 12 === 0 && typeof who.damage === "function") {
            who.damage(0.12 * (1 + (tech && tech.isCrit && Math.random() < 0.01 ? 4 : 0)));
        }
    }

    function affectArray(list, target, reverse) {
        if (!Array.isArray(list)) return;
        for (let i = 0; i < list.length; i++) affect(list[i], target, reverse);
    }

    const gravityGun = {
        name: "gravity gun",
        ammo: 80,
        ammoPack: 20,
        have: false,
        isRecentlyShown: false,
        description: "Pull targets toward your aim point. Hold FIELD while firing to reverse the gravity and blast them away.",
        chooseFireMethod() { },
        do() {
            if (!input.fire) return;
            const target = aimPoint();
            const reverse = !!input.field;

            affectArray(mob, target, reverse);
            affectArray(body, target, reverse);
            affectArray(powerUp, target, reverse);

            // Draw the gravity beam and focal point.
            ctx.save();
            ctx.globalAlpha = 0.55;
            ctx.strokeStyle = reverse ? "#777" : "#333";
            ctx.lineWidth = reverse ? 5 : 3;
            ctx.beginPath();
            ctx.moveTo(m.pos.x, m.pos.y);
            ctx.lineTo(target.x, target.y);
            ctx.stroke();
            ctx.globalAlpha = 0.9;
            ctx.beginPath();
            ctx.arc(target.x, target.y, reverse ? 25 : 18, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        },
        fire() {
            const target = aimPoint();
            const reverse = !!input.field;

            affectArray(mob, target, reverse);
            affectArray(body, target, reverse);
            affectArray(powerUp, target, reverse);

            // Stronger impulse on the trigger pulse.
            const all = [];
            if (Array.isArray(mob)) all.push(...mob);
            if (Array.isArray(body)) all.push(...body);
            for (const who of all) {
                if (!who || !who.position || who === player) continue;
                const d = dist(who.position, target);
                if (d > 500 || !visible(who) || who.isInvulnerable || who.isBadTarget) continue;
                const dx = target.x - who.position.x;
                const dy = target.y - who.position.y;
                const len = Math.hypot(dx, dy) || 1;
                let impulse = 0.014 * who.mass * (1 - d / 500);
                if (who.isBoss) impulse *= 0.2;
                if (reverse) impulse *= -1.8;
                Matter.Body.applyForce(who, who.position, {
                    x: dx / len * impulse,
                    y: dy / len * impulse
                });
            }
            m.fireCDcycle = m.cycle + (reverse ? 16 : 10);
        }
    };

    b.guns.push(gravityGun);
    window.aviGravityGun = gravityGun;
})();
