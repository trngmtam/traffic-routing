/* =========================================
   TRAFFIC VISUALIZATION ENGINE (PHYSICS & RENDER)
   ========================================= */
   class TrafficVisualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if(!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.roads = [];
        this.cars = []; 
        
        // Settings
        this.carLength = 35; 
        this.carWidth = 18;
        this.minGap = 20; // Distance required to enter a new road
        
        this.onCarFinishRoad = null; 

        this.resize();
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    resize() {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    addRoad(id, x1, y1, x2, y2, color = '#bdc3c7', width = 30, initialSpeed = 1.0) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx*dx + dy*dy);
        const angle = Math.atan2(dy, dx);
        
        this.roads.push({ 
            id, x1, y1, x2, y2, 
            dx, dy, len, angle, 
            color, width, 
            speedFactor: initialSpeed 
        });
    }

    spawnCar(roadId, color = '#2980b9', existingCar = null) {
        const roadIndex = this.roads.findIndex(r => r.id === roadId);
        if(roadIndex === -1) return false;

        const road = this.roads[roadIndex];
        
        // CHECK: Is the entrance clear?
        let minProg = 1.0;
        let lastCar = null;
        
        for(let c of this.cars) {
            if(c.roadIndex === roadIndex && c.progress < minProg) {
                minProg = c.progress;
                lastCar = c;
            }
        }

        if (lastCar) {
            const lastCarDist = lastCar.progress * road.len;
            const requiredSpace = this.carLength + this.minGap;
            
            // If the last car hasn't moved far enough, BLOCK entry.
            if (lastCarDist < requiredSpace) return false;
        }

        this.cars.push({
            roadIndex: roadIndex,
            progress: 0,
            color: existingCar ? existingCar.color : color, 
            speed: existingCar ? existingCar.speed : 0      
        });
        
        return true;
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 1. Draw Roads
        this.roads.forEach(r => {
            this.ctx.beginPath();
            this.ctx.moveTo(r.x1, r.y1);
            this.ctx.lineTo(r.x2, r.y2);
            this.ctx.strokeStyle = r.color;
            this.ctx.lineWidth = r.width;
            this.ctx.lineCap = 'round';
            this.ctx.stroke();
            
            this.ctx.beginPath();
            this.ctx.moveTo(r.x1, r.y1);
            this.ctx.lineTo(r.x2, r.y2);
            this.ctx.strokeStyle = '#ecf0f1';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([8, 8]);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        });

        // 2. Physics & Logic 
        this.roads.forEach((road, rIdx) => {
            let roadCars = this.cars.filter(c => c.roadIndex === rIdx);
            roadCars.sort((a, b) => b.progress - a.progress);

            for(let i = 0; i < roadCars.length; i++) {
                let car = roadCars[i];
                let carAhead = roadCars[i-1]; 

                let targetSpeed = 0.01 * road.speedFactor; 
                
                // Interaction with Car Ahead
                if (carAhead) {
                    const myPos = car.progress * road.len;
                    const aheadPos = carAhead.progress * road.len;
                    const dist = aheadPos - myPos;
                    const safeDist = this.carLength + 15;

                    if (dist < safeDist) {
                        targetSpeed = 0; // Stop
                        const clampedPos = aheadPos - safeDist;
                        car.progress = clampedPos / road.len; 
                    } else if (dist < safeDist + 60) {
                        targetSpeed *= 0.3; // Brake
                    }
                }
                
                car.progress += targetSpeed;
            }
        });

        // 3. Render & Transition
        for (let i = this.cars.length - 1; i >= 0; i--) {
            let car = this.cars[i];
            let road = this.roads[car.roadIndex];

            // TRANSITION LOGIC
            if(car.progress >= 1) {
                let moved = true; 
                
                if(this.onCarFinishRoad) {
                    // Try to move to next road
                    moved = this.onCarFinishRoad(car, road.id);
                }
                
                if (moved) {
                    // Success: Remove from current road
                    this.cars.splice(i, 1);
                    continue; 
                } else {
                    // Failure: Road blocked! Stop at intersection.
                    car.progress = 1;
                    car.speed = 0;
                    // It stays in the array and gets drawn at the end of the road
                }
            }

            // Draw Car
            let curX = road.x1 + (road.dx * car.progress);
            let curY = road.y1 + (road.dy * car.progress);

            this.ctx.save();
            this.ctx.translate(curX, curY);
            this.ctx.rotate(road.angle);
            
            this.ctx.fillStyle = car.color;
            this.ctx.fillRect(-this.carLength/2, -this.carWidth/2, this.carLength, this.carWidth);
            this.ctx.fillStyle = "rgba(0,0,0,0.3)";
            this.ctx.fillRect(0, -this.carWidth/2 + 1, 6, this.carWidth - 2);
            this.ctx.fillStyle = "#f1c40f"; 
            this.ctx.fillRect(this.carLength/2 - 2, -this.carWidth/2, 2, 3);
            this.ctx.fillRect(this.carLength/2 - 2, this.carWidth/2 - 3, 2, 3);
            this.ctx.restore();
        }

        requestAnimationFrame(this.animate);
    }
}

/* =========================================
   MODULE LOGIC
   ========================================= */

let viz; 

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('m1-canvas')) initMod1();
    if (document.getElementById('m2-canvas')) initMod2();
    if (document.getElementById('m3-canvas')) initMod3();
    if (document.getElementById('m4-canvas')) initMod4();
});

// --- MODULE 1 ---
let m1_carsA = 4000;
const m1_total = 4000;

function initMod1() {
    viz = new TrafficVisualizer('m1-canvas');
    const w = viz.canvas.width;
    const h = viz.canvas.height;
    
    viz.addRoad('A', 50, h*0.3, w-50, h*0.3, '#95a5a6'); 
    viz.addRoad('B', 50, h*0.7, w-50, h*0.7, '#95a5a6'); 
    
    setInterval(() => {
        if(Math.random() < (m1_carsA/m1_total)) viz.spawnCar('A', '#e74c3c');
        else viz.spawnCar('B', '#27ae60');
    }, 100); 

    updateMod1();
}

function updateMod1() {
    let m1_carsB = m1_total - m1_carsA;
    let timeA = 10 + (m1_carsA / 100);
    let timeB = 45;

    viz.roads.find(r => r.id === 'A').speedFactor = 10 / timeA;
    viz.roads.find(r => r.id === 'B').speedFactor = 10 / 45; 

    document.getElementById('val-a-cars').innerText = m1_carsA;
    document.getElementById('val-a-time').innerText = timeA.toFixed(1) + " min";
    document.getElementById('val-b-cars').innerText = m1_carsB;
    document.getElementById('val-b-time').innerText = timeB + " min";

    let msg = document.getElementById('m1-msg');
    if(Math.abs(timeA - timeB) < 1) {
        msg.innerHTML = "<strong>Equilibrium:</strong> Times are equal.";
        msg.style.color = "var(--accent)";
    } else {
        msg.innerHTML = timeA > timeB ? "Route A is slower! Switch to B." : "Route A is faster! Switch to A.";
        msg.style.color = "var(--danger)";
    }
}
function mod1_move(dir) {
    if(dir === 'toB' && m1_carsA >= 100) m1_carsA -= 100;
    if(dir === 'toA' && m1_carsA <= 3900) m1_carsA += 100;
    updateMod1();
}
function mod1_reset() { m1_carsA = 4000; updateMod1(); }


// --- MODULE 2: BRAESS'S PARADOX (REFINED) ---
let m2_shortcut = false;

function initMod2() {
    viz = new TrafficVisualizer('m2-canvas');
    const w = viz.canvas.width;
    const h = viz.canvas.height;

    const A = { x: 50, y: h/2 };         
    const B = { x: w - 50, y: h/2 };     
    const N = { x: w/2, y: 50 };         
    const S = { x: w/2, y: h - 50 };     

    // 1. Top Route
    viz.addRoad('Hwy_Top', A.x, A.y, N.x, N.y, '#95a5a6', 30, 1.0); 
    viz.addRoad('Single_Top', N.x, N.y, B.x, B.y, '#95a5a6', 10, 1.0); 

    // 2. Bottom Route
    viz.addRoad('Single_Bot', A.x, A.y, S.x, S.y, '#95a5a6', 10, 1.0); 
    viz.addRoad('Hwy_Bot', S.x, S.y, B.x, B.y, '#95a5a6', 30, 1.0); 

    // 3. Connector
    viz.addRoad('Connector', S.x, S.y, N.x, N.y, '#e74c3c', 12, 1.0);

    // --- SMART ROUTING ---
    viz.onCarFinishRoad = (car, finishedRoadId) => {
        let spawned = false;

        // NORTH JUNCTION MERGE
        if (finishedRoadId === 'Hwy_Top' || finishedRoadId === 'Connector') {
            spawned = viz.spawnCar('Single_Top', car.color, car);
        } 
        
        // SOUTH JUNCTION DECISION
        else if (finishedRoadId === 'Single_Bot') {
            if (m2_shortcut) {
                spawned = viz.spawnCar('Connector', car.color, car);
            } else {
                spawned = viz.spawnCar('Hwy_Bot', car.color, car);
            }
        }
        else {
            spawned = true; // Exit map
        }
        return spawned;
    };

    // --- SPAWNING LOGIC ---
    setInterval(() => {
        if (m2_shortcut) {
            // SCENARIO B: Open
            // High volume on Shortcut path, Moderate volume on Highway path
            if (Math.random() < 0.7) { 
                if (Math.random() < 0.8) viz.spawnCar('Single_Bot', '#e74c3c'); 
                else viz.spawnCar('Hwy_Top', '#2980b9'); 
            }
        } else {
            // SCENARIO A: Closed
            // Even split
            if (Math.random() < 0.5) { 
                if (Math.random() < 0.5) viz.spawnCar('Hwy_Top', '#2980b9'); 
                else viz.spawnCar('Single_Bot', '#2ecc71');
            }
        }
    }, 150);

    updateMod2();
}

function updateMod2() {
    const status = document.getElementById('m2-status');
    const time = document.getElementById('m2-time');

    if(m2_shortcut) {
        status.innerText = "Shortcut OPEN (Nash Equilibrium)";
        time.innerText = "32 min"; 
        time.style.color = "#e74c3c"; 

        // LOGIC FOR JAM:
        // 1. Single_Top is overwhelmed (Slow speed).
        // 2. Connector is aggressive (Fast speed).
        // 3. Hwy_Top is Fast, but hits the wall at Single_Top.
        
        viz.updateSpeed('Hwy_Top', 2.0);    // Rushing in
        viz.updateSpeed('Single_Bot', 0.5); 
        viz.updateSpeed('Connector', 3.0);  // Dumping cars fast
        viz.updateSpeed('Single_Top', 0.3); // THE BOTTLENECK

    } else {
        status.innerText = "Shortcut CLOSED (System Optimum)";
        time.innerText = "30 min"; 
        time.style.color = "#27ae60"; 

        // LOGIC FOR FLOW:
        // Single_Top must be FASTER than Hwy_Top to prevent backup.
        
        viz.updateSpeed('Hwy_Top', 0.8);     // Normal Highway Pace
        viz.updateSpeed('Single_Top', 1.2);  // Fast clearing (No Backup!)
        viz.updateSpeed('Single_Bot', 0.8);  
        viz.updateSpeed('Hwy_Bot', 0.8);     
        viz.updateSpeed('Connector', 0);     
    }
}

function mod2_toggle() { 
    m2_shortcut = !m2_shortcut; 
    updateMod2(); 
}

// --- MODULE 4 ---
function initMod4() {
    viz = new TrafficVisualizer('m4-canvas');
    const w = viz.canvas.width;
    const h = viz.canvas.height;
    
    // Initial roads with slower base speed (0.5) for better visibility
    viz.addRoad('Main', 50, h*0.3, w-50, h*0.3, '#95a5a6', 30, 0.5);
    viz.addRoad('Long', 50, h*0.7, w-50, h*0.7, '#95a5a6', 30, 0.5);

    const slider = document.getElementById('m4-slider');
    
    // SPAWN LOOP
    setInterval(() => {
        let toll = parseInt(slider.value);
        // Calculate congestion: Higher Toll = Fewer Cars on Main
        let carsOnMain = Math.max(0, 4000 - (toll * 200));
        let probMain = carsOnMain / 4000;
        
        if(Math.random() < probMain) viz.spawnCar('Main', '#e74c3c'); // Red = Main (Paying Toll)
        else viz.spawnCar('Long', '#27ae60'); // Green = Detour (Free)
    }, 150); 

    // UI UPDATE & SPEED LOGIC
    slider.oninput = function() {
        let toll = parseInt(this.value);
        
        // 1. Update Price Text
        let tollText = document.getElementById('val-toll');
        if(tollText) tollText.innerText = "$" + toll;
        
        // 2. Calculate Time
        let carsOnMain = Math.max(0, 4000 - (toll * 200)); 
        let timeMain = 10 + (carsOnMain / 100); // 10 mins (empty) -> 50 mins (full)
        
        let timeText = document.getElementById('val-sys-time');
        if(timeText) timeText.innerText = timeMain.toFixed(1) + " min";
        
        // 3. Visual Speed Adjustment
        // Formula: 5 / time. Slower speed makes the difference more obvious.
        viz.updateSpeed('Main', 5 / timeMain);
        viz.updateSpeed('Long', 5 / 45); 
        
        // 4. DYNAMIC ADVICE LOGIC
        let advice = document.getElementById('m4-advice');
        if (advice) {
            if(toll > 12) {
                // Toll > $12 (Too Expensive)
                advice.innerText = "Toll too high! Main road is empty, resources wasted.";
                advice.style.color = "#e74c3c"; // Red
            } else if(toll >= 6) {
                // Toll $6 - $12 (Optimal)
                advice.innerText = "Optimal! Traffic is flowing efficiently.";
                advice.style.color = "#2ecc71"; // Green
            } else {
                // Toll < $6 (Too Cheap)
                advice.innerText = "Toll too low! Everyone pays, but congestion remains.";
                advice.style.color = "#f1c40f"; // Yellow
            }
        }
    }
    
    // Trigger once on load to set initial state
    slider.oninput();
} 