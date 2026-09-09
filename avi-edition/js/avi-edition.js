/*
 * AVI EDITION - n-gon expansion layer
 * GPL-compatible add-on. The upstream game remains the base game.
 *
 * 1 Plasma rifle  2 Rocket launcher  3 Gravity gun  4 Singularity shotgun
 * Z Time field  X Repulsor field  C Singularity field
 * 7-0 toggle Avi tech upgrades, L Avi Arena, N enemy wave, B boss
 */
(() => {
    const boot = () => {
        if (typeof Matter === 'undefined' || typeof player === 'undefined' || typeof m === 'undefined' || typeof simulation === 'undefined' || typeof ctx === 'undefined') {
            setTimeout(boot, 500); return;
        }
        if (window.aviEdition) return;

        const A = window.aviEdition = {
            weapon: 1,
            firing: false,
            nextFire: 0,
            field: null,
            tech: { overcharge:false, massDriver:false, reactor:false, nanites:false, glass:false },
            rockets: [],
            enemies: [],
            arena: [],
            flash: 0,
            message: 'AVI EDITION ONLINE'
        };

        const V = Matter.Vector, B = Matter.Body, C = Matter.Composite, Bodies = Matter.Bodies;
        const aim = () => simulation.mouseInGame || m.pos;
        const clamp = (x,a,b) => Math.max(a, Math.min(b,x));
        const d2 = (a,b) => { const x=a.x-b.x,y=a.y-b.y; return x*x+y*y; };
        const damageScale = () => (A.tech.overcharge ? 1.55 : 1) * (A.tech.glass ? 2.1 : 1);
        const fireDelay = n => A.tech.reactor ? Math.max(3, Math.floor(n*0.72)) : n;

        function msg(s) { A.message=s; A.flash=30; if (typeof simulation.inGameConsole==='function') simulation.inGameConsole('<span class="color-g">AVI</span>: '+s); }
        function lineHit(p,a,b) {
            const abx=b.x-a.x, aby=b.y-a.y, apx=p.x-a.x, apy=p.y-a.y;
            const q=clamp((apx*abx+apy*aby)/(abx*abx+aby*aby||1),0,1);
            const x=a.x+abx*q,y=a.y+aby*q;
            return Math.hypot(p.x-x,p.y-y);
        }
        function nativeMobs(fn) {
            if (!Array.isArray(mob)) return;
            for (const w of mob) if (w && w.alive && w.position) fn(w);
        }
        function customEnemies(fn) { for (const e of A.enemies) if (e.alive && e.body) fn(e); }
        function damageTarget(w, amount) {
            if (w && typeof w.damage === 'function') w.damage(amount, true);
            else if (w && typeof w.health === 'number') { w.health -= amount; if (w.health <= 0) killCustom(w); }
        }
        function killCustom(e) {
            if (!e.alive) return; e.alive=false;
            try { C.remove(engine.world,e.body); } catch (_) {}
            if (e.boss) msg('AVI BOSS DEFEATED');
        }
        function blast(pos, radius, amount, impulse=0.02) {
            nativeMobs(w => {
                const dist=Math.sqrt(d2(w.position,pos));
                if (dist<radius) {
                    const fall=1-dist/radius;
                    damageTarget(w,amount*fall*damageScale());
                    const u=V.normalise(V.sub(w.position,pos));
                    B.applyForce(w,w.position,V.mult(u,impulse*w.mass*fall));
                }
            });
            customEnemies(e => {
                const dist=Math.sqrt(d2(e.body.position,pos));
                if (dist<radius) {
                    const fall=1-dist/radius; e.health-=amount*fall*damageScale();
                    B.applyForce(e.body,e.body.position,V.mult(V.normalise(V.sub(e.body.position,pos)),impulse*e.body.mass*fall));
                    if(e.health<=0) killCustom(e);
                }
            });
        }

        function plasma() {
            const a=m.pos, b=aim(), dir=V.normalise(V.sub(b,a)), end=V.add(a,V.mult(dir,1300));
            nativeMobs(w => { const r=lineHit(w.position,a,end); const along=V.dot(V.sub(w.position,a),dir); if(r<Math.max(28,w.radius||20)&&along>0&&along<1300) damageTarget(w,0.42*damageScale()); });
            customEnemies(e => { const r=lineHit(e.body.position,a,end); const along=V.dot(V.sub(e.body.position,a),dir); if(r<32&&along>0&&along<1300){e.health-=0.55*damageScale();if(e.health<=0)killCustom(e);} });
            A.flash=5;
        }
        function rocket() {
            const a=m.pos,b=aim(),dir=V.normalise(V.sub(b,a));
            const body=Bodies.circle(a.x+dir.x*45,a.y+dir.y*45,10,{isSensor:true,frictionAir:0.003,restitution:0.2});
            body.aviRocket=true; C.add(engine.world,body);
            B.setVelocity(body,V.mult(dir,26)); A.rockets.push({body,life:90});
        }
        function gravity() {
            const p=aim();
            const pull=!!(input && input.field);
            nativeMobs(w=>{ const dist=Math.sqrt(d2(w.position,p)); if(dist<900){ const u=V.normalise(V.sub(p,w.position)); let s=0.0035*(1-dist/900)*w.mass; if(w.isBoss)s*=0.22; if(pull)s*=-1.7; B.applyForce(w,w.position,V.mult(u,s)); if(dist<65&&!pull)damageTarget(w,0.12*damageScale()); }});
            customEnemies(e=>{ const dist=Math.sqrt(d2(e.body.position,p)); if(dist<900){const u=V.normalise(V.sub(p,e.body.position));let s=0.004*(1-dist/900)*e.body.mass;if(e.boss)s*=0.25;if(pull)s*=-1.7;B.applyForce(e.body,e.body.position,V.mult(u,s));if(dist<65&&!pull)e.health-=0.08*damageScale();if(e.health<=0)killCustom(e);}});
            A.flash=3;
        }
        function singularity() { blast(aim(),300,0.85,0.05); }

        function fire() {
            if (m.cycle < A.nextFire) return;
            A.nextFire=m.cycle+fireDelay([0,5,18,8,14][A.weapon]);
            if (A.weapon===1) plasma();
            if (A.weapon===2) rocket();
            if (A.weapon===3) gravity();
            if (A.weapon===4) singularity();
        }

        function updateRockets() {
            for(let i=A.rockets.length-1;i>=0;i--){const r=A.rockets[i]; if(!r.body){A.rockets.splice(i,1);continue;} r.life--; let hit=false;
                nativeMobs(w=>{if(d2(w.position,r.body.position)<Math.pow((w.radius||25)+16,2))hit=true;});
                customEnemies(e=>{if(d2(e.body.position,r.body.position)<Math.pow(35,2))hit=true;});
                if(r.life<=0)hit=true;
                if(hit){const p={x:r.body.position.x,y:r.body.position.y};blast(p,190,1.35,0.08);try{C.remove(engine.world,r.body);}catch(_){}A.rockets.splice(i,1);}
            }
        }

        function spawnCustomEnemy(x,y,boss=false) {
            const body=Bodies.polygon(x,y,boss?10:7,boss?55:25,{density:boss?0.012:0.006,restitution:0.8,frictionAir:0.01});
            body.aviEnemy=true; C.add(engine.world,body);
            const e={body,health:boss?80:10,boss,alive:true}; A.enemies.push(e); return e;
        }
        function updateEnemies() {
            for(let i=A.enemies.length-1;i>=0;i--){const e=A.enemies[i];if(!e.alive){A.enemies.splice(i,1);continue;} const p=e.body.position, to=V.sub(player.position,p),dist=Math.sqrt(to.x*to.x+to.y*to.y)||1,u=V.mult(to,1/dist);
                B.applyForce(e.body,p,V.mult(u,(e.boss?0.0008:0.0013)*e.body.mass));
                if(dist<70 && m.immuneCycle<m.cycle && typeof m.takeDamage==='function'){m.takeDamage(e.boss?0.22:0.07);m.immuneCycle=m.cycle+20;}
            }
        }
        function newArena() {
            for(const x of A.arena) try{C.remove(engine.world,x)}catch(_){ }
            A.arena=[];
            const x=player.position.x,y=player.position.y;
            const walls=[[x-700,y-500,1400,40],[x-700,y+460,1400,40],[x-700,y-500,40,1000],[x+660,y-500,40,1000]];
            for(const q of walls){const w=Bodies.rectangle(q[0]+q[2]/2,q[1]+q[3]/2,q[2],q[3],{isStatic:true});C.add(engine.world,w);A.arena.push(w);}
            for(let i=0;i<7;i++)spawnCustomEnemy(x+(Math.random()-.5)*1000,y+(Math.random()-.5)*650,false);
            spawnCustomEnemy(x,y-300,true); msg('AVI ARENA // BOSS WAVE');
        }
        function wave(){for(let i=0;i<8;i++)spawnCustomEnemy(player.position.x+(Math.random()-.5)*900,player.position.y+(Math.random()-.5)*500,false);msg('CUSTOM ENEMY WAVE');}
        function boss(){spawnCustomEnemy(player.position.x+450,player.position.y-100,true);msg('AVI BOSS INBOUND');}

        function fieldUpdate() {
            const p=player.position;
            if(A.field==='time'){nativeMobs(w=>{if(d2(w.position,p)<360*360)B.setVelocity(w,V.mult(w.velocity,0.91));});}
            if(A.field==='repulse'){nativeMobs(w=>{const d=Math.sqrt(d2(w.position,p));if(d<420){const u=V.normalise(V.sub(w.position,p));B.applyForce(w,w.position,V.mult(u,0.004*w.mass));}});}
            if(A.field==='singularity'){nativeMobs(w=>{const d=Math.sqrt(d2(w.position,aim()));if(d<500){const u=V.normalise(V.sub(aim(),w.position));B.applyForce(w,w.position,V.mult(u,0.002*w.mass));}});}
        }

        function techToggle(n){const keys=['overcharge','massDriver','reactor','nanites','glass'];const k=keys[n];A.tech[k]=!A.tech[k];msg(k.toUpperCase()+': '+(A.tech[k]?'ON':'OFF'));}
        function setWeapon(n){A.weapon=n;A.field=null;msg(['','PLASMA RIFLE','ROCKET LAUNCHER','GRAVITY GUN','SINGULARITY SHOTGUN'][n]);}

        const oldFire = b && b.fire ? b.fire : null;
        function syncNativeFire(){ if(!b)return; b.fire = A.weapon ? function(){} : (oldFire||function(){}); }
        ['keydown','keyup'].forEach(type=>window.addEventListener(type,e=>{
            if(e.repeat&&type==='keydown')return;
            const k=e.key.toLowerCase();
            if(type==='keydown'){
                if(k>='1'&&k<='4')setWeapon(Number(k));
                if(k==='5'){A.weapon=0;syncNativeFire();msg('N-GON WEAPONS RESTORED');}
                if(k==='7')techToggle(0); if(k==='8')techToggle(1); if(k==='9')techToggle(2); if(k==='0')techToggle(3);
                if(k==='l')newArena(); if(k==='n')wave(); if(k==='b')boss();
                if(k==='z')A.field='time'; if(k==='x')A.field='repulse'; if(k==='c')A.field='singularity';
            } else {if(k==='z'||k==='x'||k==='c')A.field=null;}
        });

        function draw(){
            try{
                ctx.save();
                if(player&&player.render){player.render.fillStyle='#12d8ff';player.render.strokeStyle='#ffffff';player.render.lineWidth=2;}
                // custom enemy rings
                for(const e of A.enemies)if(e.alive){ctx.beginPath();ctx.arc(e.body.position.x,e.body.position.y,e.boss?68:34,0,Math.PI*2);ctx.strokeStyle=e.boss?'#ff304f':'#ffb000';ctx.globalAlpha=.5;ctx.stroke();}
                const old=ctx.getTransform?ctx.getTransform():null;
                ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.font='bold 14px Arial';ctx.fillStyle='#fff';
                ctx.fillText('AVI EDITION',18,24);ctx.font='13px Arial';
                const names=['N-GON','PLASMA RIFLE','ROCKET LAUNCHER','GRAVITY GUN','SINGULARITY SHOTGUN'];ctx.fillText('Weapon: '+names[A.weapon],18,44);
                ctx.fillText('Fields: Z Time  X Repulse  C Singularity',18,62);ctx.fillText('Tech: 7 Overcharge 8 Mass 9 Reactor 0 Nanites',18,80);
                ctx.fillText('L Arena  N Wave  B Boss  5 Restore n-gon',18,98);
                if(A.field){ctx.fillText('FIELD ACTIVE: '+A.field.toUpperCase(),18,116);}
                if(A.flash>0){ctx.globalAlpha=Math.min(1,A.flash/10);ctx.fillStyle='#12d8ff';ctx.font='bold 22px Arial';ctx.fillText(A.message,18,148);A.flash--;}
                ctx.restore();
            }catch(_){ }
        }

        function tick(){
            if(A.weapon) {syncNativeFire(); if(input&&input.fire)fire(); fieldUpdate();}
            updateRockets(); updateEnemies(); draw();
            requestAnimationFrame(tick);
        }
        syncNativeFire();
        msg('1-4 WEAPONS READY');
        requestAnimationFrame(tick);
    };
    boot();
})();
