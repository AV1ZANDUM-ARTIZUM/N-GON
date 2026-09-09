/*
 * AVI EDITION - n-gon expansion layer
 * GPL-compatible add-on. The upstream game remains the base game.
 *
 * 1 Plasma Rifle  2 Rocket Launcher  3 Gravity Gun  4 Singularity Shotgun
 * Z Time field  X Repulsor field  C Singularity field
 * 7 Overcharge  8 Mass Driver  9 Reactor  0 Nanites
 * L Avi Arena  N enemy wave  B boss  5 restore n-gon weapons
 */
(() => {
    const boot = () => {
        if (typeof Matter === 'undefined' || typeof player === 'undefined' || typeof m === 'undefined' || typeof simulation === 'undefined' || typeof input === 'undefined' || typeof ctx === 'undefined') {
            setTimeout(boot, 250);
            return;
        }
        if (window.aviEdition) return;

        const A = window.aviEdition = {
            weapon: 1,
            field: null,
            nextFire: 0,
            tech: { overcharge:false, massDriver:false, reactor:false, nanites:false },
            rockets: [],
            enemies: [],
            arena: [],
            message: 'AVI EDITION ONLINE'
        };

        const V = Matter.Vector;
        const B = Matter.Body;
        const C = Matter.Composite;
        const Bodies = Matter.Bodies;
        const clamp = (x,a,b) => Math.max(a, Math.min(b,x));
        const dist2 = (a,b) => { const x=a.x-b.x, y=a.y-b.y; return x*x+y*y; };
        const cycle = () => Number.isFinite(simulation.cycle) ? simulation.cycle : 0;
        const aim = () => simulation.mouseInGame || m.pos;
        const damageScale = () => A.tech.overcharge ? 1.55 : 1;
        const fireDelay = n => A.tech.reactor ? Math.max(3, Math.floor(n * 0.72)) : n;

        function announce(text) {
            A.message = text;
            A.messageUntil = Date.now() + 1800;
            if (typeof simulation.inGameConsole === 'function') {
                try { simulation.inGameConsole('<span class="color-g">AVI</span>: ' + text); } catch (_) {}
            }
            const el = document.getElementById('avi-message');
            if (el) el.textContent = text;
        }

        function makeHud() {
            if (document.getElementById('avi-hud')) return;
            const hud = document.createElement('div');
            hud.id = 'avi-hud';
            hud.style.cssText = [
                'position:fixed','left:50%','top:10px','transform:translateX(-50%)',
                'z-index:99999','pointer-events:none','font-family:Arial,sans-serif',
                'font-size:14px','line-height:1.35','color:#fff','background:rgba(20,25,30,.88)',
                'border:2px solid #12d8ff','border-radius:8px','padding:9px 14px',
                'min-width:330px','box-shadow:0 2px 12px rgba(0,0,0,.45)','text-align:center'
            ].join(';');
            hud.innerHTML = '<div style="font-size:20px;font-weight:800;color:#12d8ff;letter-spacing:1px">AVI EDITION</div>' +
                '<div id="avi-status">Loading Avi Edition...</div>' +
                '<div style="margin-top:4px;font-size:12px;color:#ddd">1-4 Weapons &nbsp;|&nbsp; Z/X/C Fields &nbsp;|&nbsp; 7/8/9/0 Tech</div>' +
                '<div style="font-size:12px;color:#bbb">L Arena &nbsp; N Wave &nbsp; B Boss &nbsp; 5 Restore</div>' +
                '<div id="avi-message" style="margin-top:4px;color:#12d8ff;font-weight:700"></div>';
            document.body.appendChild(hud);
            announce(A.message);
        }

        makeHud();

        const oldFire = b && typeof b.fire === 'function' ? b.fire : function(){};
        let nativeFireSuppressed = false;
        function syncNativeFire() {
            if (!b) return;
            if (A.weapon) {
                if (!nativeFireSuppressed) {
                    b.fire = function(){};
                    nativeFireSuppressed = true;
                }
            } else if (nativeFireSuppressed) {
                b.fire = oldFire;
                nativeFireSuppressed = false;
            }
        }

        function damageTarget(target, amount) {
            if (!target) return;
            if (typeof target.damage === 'function') {
                try { target.damage(amount, true); return; } catch (_) {}
            }
            if (typeof target.health === 'number') target.health -= amount;
        }

        function nativeMobs(fn) {
            if (!Array.isArray(mob)) return;
            for (const w of mob) if (w && w.alive && w.position) fn(w);
        }
        function customEnemies(fn) {
            for (const e of A.enemies) if (e.alive && e.body) fn(e);
        }
        function killCustom(e) {
            if (!e.alive) return;
            e.alive = false;
            try { C.remove(engine.world, e.body); } catch (_) {}
            if (e.boss) announce('AVI BOSS DEFEATED');
        }

        function lineDistance(p, a, b) {
            const abx=b.x-a.x, aby=b.y-a.y, apx=p.x-a.x, apy=p.y-a.y;
            const q=clamp((apx*abx+apy*aby)/(abx*abx+aby*aby||1),0,1);
            const x=a.x+abx*q, y=a.y+aby*q;
            return Math.hypot(p.x-x,p.y-y);
        }

        function plasma() {
            const start=m.pos, target=aim();
            const dir=V.normalise(V.sub(target,start));
            const end=V.add(start,V.mult(dir,1400));
            nativeMobs(w => {
                const along=V.dot(V.sub(w.position,start),dir);
                if (along>0 && along<1400 && lineDistance(w.position,start,end)<Math.max(28,w.radius||20)) {
                    damageTarget(w,0.42*damageScale());
                }
            });
            customEnemies(e => {
                const along=V.dot(V.sub(e.body.position,start),dir);
                if (along>0 && along<1400 && lineDistance(e.body.position,start,end)<32) {
                    e.health-=0.55*damageScale();
                    if(e.health<=0) killCustom(e);
                }
            });
        }

        function rocket() {
            const start=m.pos, target=aim(), dir=V.normalise(V.sub(target,start));
            const body=Bodies.circle(start.x+dir.x*45,start.y+dir.y*45,10,{isSensor:true,frictionAir:0.003,restitution:0.2});
            body.aviRocket=true;
            C.add(engine.world,body);
            B.setVelocity(body,V.mult(dir,26));
            A.rockets.push({body,life:100});
        }

        function blast(pos,radius,amount,impulse=0.02) {
            nativeMobs(w => {
                const d=Math.sqrt(dist2(w.position,pos));
                if(d<radius){
                    const fall=1-d/radius;
                    damageTarget(w,amount*fall*damageScale());
                    const u=V.normalise(V.sub(w.position,pos));
                    B.applyForce(w,w.position,V.mult(u,impulse*w.mass*fall));
                }
            });
            customEnemies(e => {
                const d=Math.sqrt(dist2(e.body.position,pos));
                if(d<radius){
                    const fall=1-d/radius;
                    e.health-=amount*fall*damageScale();
                    const u=V.normalise(V.sub(e.body.position,pos));
                    B.applyForce(e.body,e.body.position,V.mult(u,impulse*e.body.mass*fall));
                    if(e.health<=0)killCustom(e);
                }
            });
        }

        function gravityGun() {
            const point=aim();
            nativeMobs(w => {
                const d=Math.sqrt(dist2(w.position,point));
                if(d<900){
                    const u=V.normalise(V.sub(point,w.position));
                    const strength=0.0035*(1-d/900)*w.mass*(input.field?-1.7:1);
                    B.applyForce(w,w.position,V.mult(u,strength));
                    if(d<65 && !input.field) damageTarget(w,0.12*damageScale());
                }
            });
            customEnemies(e => {
                const d=Math.sqrt(dist2(e.body.position,point));
                if(d<900){
                    const u=V.normalise(V.sub(point,e.body.position));
                    const strength=0.004*(1-d/900)*e.body.mass*(input.field?-1.7:1);
                    B.applyForce(e.body,e.body.position,V.mult(u,strength));
                    if(d<65 && !input.field)e.health-=0.08*damageScale();
                    if(e.health<=0)killCustom(e);
                }
            });
        }

        function singularity() { blast(aim(),300,0.85,0.05); }

        function fire() {
            if(cycle()<A.nextFire)return;
            const delay=[0,5,18,8,14][A.weapon]||8;
            A.nextFire=cycle()+fireDelay(delay);
            if(A.weapon===1)plasma();
            else if(A.weapon===2)rocket();
            else if(A.weapon===3)gravityGun();
            else if(A.weapon===4)singularity();
        }

        function updateRockets() {
            for(let i=A.rockets.length-1;i>=0;i--){
                const r=A.rockets[i];
                if(!r.body){A.rockets.splice(i,1);continue;}
                r.life--;
                let hit=r.life<=0;
                nativeMobs(w=>{if(dist2(w.position,r.body.position)<Math.pow((w.radius||25)+16,2))hit=true;});
                customEnemies(e=>{if(dist2(e.body.position,r.body.position)<35*35)hit=true;});
                if(hit){
                    blast({x:r.body.position.x,y:r.body.position.y},190,1.35,0.08);
                    try{C.remove(engine.world,r.body);}catch(_){}
                    A.rockets.splice(i,1);
                }
            }
        }

        function spawnCustomEnemy(x,y,boss=false){
            const body=Bodies.polygon(x,y,boss?10:7,boss?55:25,{density:boss?0.012:0.006,restitution:0.8,frictionAir:0.01});
            body.aviEnemy=true;
            C.add(engine.world,body);
            const e={body,health:boss?80:10,boss,alive:true};
            A.enemies.push(e);
            return e;
        }

        function updateEnemies(){
            for(let i=A.enemies.length-1;i>=0;i--){
                const e=A.enemies[i];
                if(!e.alive){A.enemies.splice(i,1);continue;}
                const p=e.body.position;
                const to=V.sub(player.position,p);
                const d=Math.sqrt(to.x*to.x+to.y*to.y)||1;
                const u=V.mult(to,1/d);
                B.applyForce(e.body,p,V.mult(u,(e.boss?0.0008:0.0013)*e.body.mass));
                if(d<70 && m.alive && typeof m.damage === 'function' && cycle()%20===0){
                    try{m.damage(e.boss?0.22:0.07);}catch(_){}
                }
            }
        }

        function newArena(){
            for(const wall of A.arena)try{C.remove(engine.world,wall);}catch(_){}
            A.arena=[];
            const x=player.position.x,y=player.position.y;
            const walls=[[x-700,y-500,1400,40],[x-700,y+460,1400,40],[x-700,y-500,40,1000],[x+660,y-500,40,1000]];
            for(const q of walls){
                const wall=Bodies.rectangle(q[0]+q[2]/2,q[1]+q[3]/2,q[2],q[3],{isStatic:true});
                C.add(engine.world,wall);A.arena.push(wall);
            }
            for(let i=0;i<7;i++)spawnCustomEnemy(x+(Math.random()-.5)*1000,y+(Math.random()-.5)*650);
            spawnCustomEnemy(x,y-300,true);
            announce('AVI ARENA // BOSS WAVE');
        }
        function wave(){
            for(let i=0;i<8;i++)spawnCustomEnemy(player.position.x+(Math.random()-.5)*900,player.position.y+(Math.random()-.5)*500);
            announce('CUSTOM ENEMY WAVE');
        }
        function boss(){spawnCustomEnemy(player.position.x+450,player.position.y-100,true);announce('AVI BOSS INBOUND');}

        function fieldUpdate(){
            const p=player.position;
            if(A.field==='time')nativeMobs(w=>{if(dist2(w.position,p)<360*360)B.setVelocity(w,V.mult(w.velocity,0.91));});
            if(A.field==='repulse')nativeMobs(w=>{const d=Math.sqrt(dist2(w.position,p));if(d<420){const u=V.normalise(V.sub(w.position,p));B.applyForce(w,w.position,V.mult(u,0.004*w.mass));}});
            if(A.field==='singularity')nativeMobs(w=>{const target=aim(),d=Math.sqrt(dist2(w.position,target));if(d<500){const u=V.normalise(V.sub(target,w.position));B.applyForce(w,w.position,V.mult(u,0.002*w.mass));}});
        }

        function techToggle(name){
            A.tech[name]=!A.tech[name];
            announce(name.toUpperCase()+': '+(A.tech[name]?'ON':'OFF'));
        }
        function setWeapon(n){
            A.weapon=n;
            A.field=null;
            syncNativeFire();
            announce(n===0?'N-GON WEAPONS RESTORED':['','PLASMA RIFLE','ROCKET LAUNCHER','GRAVITY GUN','SINGULARITY SHOTGUN'][n]);
        }

        window.addEventListener('keydown',e=>{
            if(e.repeat)return;
            const k=e.key.toLowerCase();
            if(k>='1'&&k<='4')setWeapon(Number(k));
            else if(k==='5')setWeapon(0);
            else if(k==='7')techToggle('overcharge');
            else if(k==='8')techToggle('massDriver');
            else if(k==='9')techToggle('reactor');
            else if(k==='0')techToggle('nanites');
            else if(k==='l')newArena();
            else if(k==='n')wave();
            else if(k==='b')boss();
            else if(k==='z')A.field='time';
            else if(k==='x')A.field='repulse';
            else if(k==='c')A.field='singularity';
        });
        window.addEventListener('keyup',e=>{
            const k=e.key.toLowerCase();
            if(k==='z'||k==='x'||k==='c')A.field=null;
        });

        function updateHud(){
            const status=document.getElementById('avi-status');
            if(!status)return;
            const weapon=['N-GON','PLASMA RIFLE','ROCKET LAUNCHER','GRAVITY GUN','SINGULARITY SHOTGUN'][A.weapon];
            const field=A.field?A.field.toUpperCase():'OFF';
            const tech=Object.keys(A.tech).filter(k=>A.tech[k]).map(k=>k==='massDriver'?'MASS DRIVER':k.toUpperCase()).join(', ')||'none';
            status.innerHTML='<b>Weapon:</b> '+weapon+' &nbsp; <b>Field:</b> '+field+'<br><b>Tech:</b> '+tech;
            const message=document.getElementById('avi-message');
            if(message)message.textContent=Date.now()<A.messageUntil?A.message:'';
        }

        function tick(){
            try{
                syncNativeFire();
                if(A.weapon && input.fire)fire();
                if(A.weapon)fieldUpdate();
                updateRockets();
                updateEnemies();
                updateHud();
            }catch(err){
                // Keep the base n-gon game running even if an optional Avi feature fails.
                console.warn('Avi Edition:',err);
            }
        }

        announce('1-4 WEAPONS READY');
        setInterval(tick,16);
    };
    boot();
})();