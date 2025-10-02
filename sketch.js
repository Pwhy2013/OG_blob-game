let player;
let bullets = [];
let enemies = [];
let bulletSpeed = 5;
let enemySpeed = 1;
let score = 0;
let powerUp;  // Declare the power-up object
let enemyBullets = [];  // Array to store bullets fired by enemies
let spawnInterval = 120;  // Enemy spawn every 120 frames (\~2 seconds at 60fps)
let lastBossLevel = 0;
let isPaused = false;
let aoeExplosions = [];
let droneChoicePending = false;






function setup() {
createCanvas(650, 450);
player = new Player();


// Spawn some enemies at random locations
for (let i = 0; i < 5; i++) {
enemies.push(new Enemy(random(width), random(height)));
}
}


let bosses = []; // Array to store bosses


function draw() {
  background(220);
  if (player.health <= 0) {
    gameOver();
    return; // <- already present, but be sure this is above any updates
  }


  displayMeleeCooldown()
  if (isPaused) {
    fill(0);
    textSize(32);
    textAlign(CENTER, CENTER);
    text("PAUSED", width / 2, height / 2);
    return;
  }


  // Boss health bar display
  if (bosses.length > 0) {
    displayBossHealthBar(bosses[0]);
  }


  // Update and display player
  player.update();
  player.display();


  for (let i = bullets.length - 1; i >= 0; i--) {
    let bullet = bullets[i];
    bullet.update();
    bullet.display();


    // Check collision with enemies
    for (let j = enemies.length - 1; j >= 0; j--) {
      if (bullet.checkCollision(enemies[j])) {
        enemies[j].takeDamage(player.bulletDamage);
        bullets.splice(i, 1);
        break;
      }
    }


    // Check collision with bosses
    for (let j = bosses.length - 1; j >= 0; j--) {
      if (bosses[j].checkCollision(bullet)) {
        bosses[j].takeDamage(player.bulletDamage);
        bullets.splice(i, 1);
        break;
      }
    }


    if (bullet.offscreen()) {
      bullets.splice(i, 1);
    }
  }


  // Display and check collisions for enemy bullets
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    let enemyBullet = enemyBullets[i];
    enemyBullet.update();
    enemyBullet.display();


    if (enemyBullet.checkCollision(player)) {
      player.health -= enemyBullet.damage; // Deal damage to player
      enemyBullets.splice(i, 1); // Remove bullet after collision
      break;
    }


    if (enemyBullet.offscreen()) {
      enemyBullets.splice(i, 1); // Remove bullet if it's off the screen
    }
  }


  for (let i = enemies.length - 1; i >= 0; i--) {
    let enemy = enemies[i];
    enemy.update();
    enemy.display();
    if (dist(player.position.x, player.position.y, enemy.position.x, enemy.position.y) < player.size / 2 + enemy.size / 2) {
      player.health -= 10;
      enemies.splice(i, 1);
    }
  }


  if (frameCount % spawnInterval === 0) {
    spawnEnemy();
  }


  if (player.level % 5 === 0 && player.level !== lastBossLevel) {
    bosses.push(new Boss());
    lastBossLevel = player.level;
  }
  for (let boss of bosses) {
    boss.update();
    boss.display();
    boss.collideWithPlayer();  // This was missing
  }
  player.displayLevelInfo();
  // Display health bar
  displayHealthBar();
  
  // Handle AOE explosions
  for (let i = aoeExplosions.length - 1; i >= 0; i--) {
    aoeExplosions[i].update();
    aoeExplosions[i].display();
    if (aoeExplosions[i].isExpired()) {
      aoeExplosions.splice(i, 1);
    }
  }
  if (droneChoicePending) {
    fill(0);
    textSize(18);
    textAlign(CENTER, CENTER);
    text("Choose a drone:\n1. Ace Drone (Fast shooter)\n2. Laser Drone (Beam attack)\n3. AOE Drone (Explodes on contact)", width / 2, height / 2);
    return; // Skip rest of draw loop until choice made
  }


}




class Player {
constructor() {
this.position = createVector(width / 2, height / 2);
this.size = 20;
this.speed = 5;
this.health = 100;
this.xp = 0;
this.level = 1;
this.weaponLevel = 1;
this.bulletSpeed = bulletSpeed;
this.bulletDamage = 1;
this.fireRate = 1000;
this.lastShotTime = 0;
this.multiShotActive = false;
this.meleeDamage = 20;  // Melee damage value
this.meleeCooldown = 1000; // Time in ms between attacks
this.lastMeleeTime = 0;  // Track last time melee attack was used
this.slashes =[];  // Initialize the array for slashes
this.initializeKeyListener();
this.hasDrone = false;
this.drones = []; // replaces this.drone
}


update() {
let move = createVector(0, 0);
if (keyIsDown(87)) { move.y -= 1; } // W
if (keyIsDown(83)) { move.y += 1; } // S
if (keyIsDown(65)) { move.x -= 1; } // A
if (keyIsDown(68)) { move.x += 1; } // D
move.normalize().mult(this.speed);
this.position.add(move);
this.aim();
for (let drone of this.drones) {
drone.update();
}


this.constrain(); // Add this in Player's update()


if (millis() - this.lastRespawn > this.cooldown && !this.ready) {
this.respawn();
}


if (this.multiShotActive && millis() - this.multiShotTimer > 10000) { // 10 sec duration
this.multiShotActive = false;
}


if (millis() - this.lastShotTime > this.fireRate && (mouseIsPressed || keyIsDown(32))) {
this.shoot();
this.lastShotTime = millis();
}




// Check for melee attack
if (millis() - this.lastMeleeTime > this.meleeCooldown && keyIsDown(69)) {  // E key for melee
  this.meleeAttack();
  this.lastMeleeTime = millis();
}






// Update slashes (remove expired slashes)
for (let i = this.slashes.length - 1; i >= 0; i--) {
  if (this.slashes[i].update()) {
    this.slashes.splice(i, 1);
  }
}




}


display() {
fill(0, 255, 0);
ellipse(this.position.x, this.position.y, this.size);


for (let drone of this.drones) {




drone.display();
}




// Display all active slashes
for (let slash of this.slashes) {
  slash.display();
}




}


aim() {
let mousePos = createVector(mouseX, mouseY);
let angle = atan2(mousePos.y - this.position.y, mousePos.x - this.position.x);
push();
translate(this.position.x, this.position.y);
rotate(angle);
rect(0, -5, this.size, 10); // Direction player is facing
pop();
}


shoot() {
if (this.multiShotActive) {
for (let i = -1; i <= 1; i++) {
let angleOffset = radians(15 * i);
let bullet = new Bullet(this.position.x, this.position.y, mouseX, mouseY, this.bulletSpeed, this.bulletDamage, angleOffset);
bullets.push(bullet);
}
} else {
let bullet = new Bullet(this.position.x, this.position.y, mouseX, mouseY, this.bulletSpeed, this.bulletDamage);
bullets.push(bullet);
}
}


meleeAttack() {
// Create the melee slash at the player's position, facing the mouse
let angle = atan2(mouseY - this.position.y, mouseX - this.position.x);
this.slashes.push(new Slash(this.position.x, this.position.y, angle));




// Check for collisions with enemies in the slash area
for (let enemy of enemies) {
  let d = dist(this.position.x, this.position.y, enemy.position.x, enemy.position.y);
  if (d < 75) {  // Melee range
    enemy.takeDamage(this.meleeDamage); // Apply melee damage
  }
}




}


activateMultiShot() {
this.multiShotActive = true;
}


constrain(){// Ensure the player stays within canvas bounds
this.position.x = constrain(this.position.x, this.size / 2, width - this.size / 2);
this.position.y = constrain(this.position.y, this.size / 2, height - this.size / 2);
}


increaseXP(amount) {
this.xp += amount;
this.checkLevelUp();
}


checkLevelUp() {
let xpNeeded = 100 * pow(1.2, this.level - 1); // scales exponentially
if (this.xp >= xpNeeded) {
this.level++;
this.xp = 0;
this.upgradeWeapon();
this.health =100;
}
}


initializeKeyListener() {
document.addEventListener('keydown', (event) => {
switch (event.key.toLowerCase()) {
case 'o': this.fireRate = 0; break;
case 'i': this.multiShotActive = true; break;
case 'j': this.health = 100; break;
case 'l': this.level++; this.upgradeWeapon(); break;
case 'k': this.meleeCooldown = 10; break;
}
});
}


upgradeWeapon() {
  if (this.level % 2 === 0) {
    this.weaponLevel++;
    if (this.weaponLevel === 2) {
      this.bulletSpeed = 7;
      this.fireRate = 200;
    } else if (this.weaponLevel === 3) {
      this.bulletDamage = 2;
    } else if (this.weaponLevel === 4) {
      this.bulletDamage = 5;
    } else if (this.weaponLevel === 5) {
      this.hasDrone = true;
      this.drones.push(new Drone(this, 0)); // First basic drone at angle 0
      Drone.fireRate = 500;
    } else if (this.weaponLevel === 6) {
      droneChoicePending = true; // Show drone choice UI
      noLoop(); // Pause the game
    } else if (this.weaponLevel === 10) {
      this.bulletSpeed = 20;
      droneChoicePending = true; // Show drone choice UI
      noLoop(); // Pause the game
      Drone.fireRate = 100;
    } else if (this.weaponLevel === 15) {
      droneChoicePending = true; // Show drone choice UI
      noLoop(); // Pause the game
      Drone.fireRate = 10;
    }
  }
}










displayLevelInfo() {
fill(0);
textSize(16);
text("Level: " + this.level, 10, 20);
text("XP: " + this.xp, 10, 40);
text("Weapon Level: " + this.weaponLevel, 10, 60);
text("Health: " + this.health, 10, 80);
text("Score: " + score, 10, 100); // Display the score here
}
}


class Bullet {
constructor(x, y, targetX, targetY, speed, damage, angleOffset = 0) {
this.position = createVector(x, y);
this.velocity = createVector(targetX - x, targetY - y);
this.velocity.normalize().mult(speed);




// Apply angle offset for multi-shot bullets
this.velocity.rotate(angleOffset);




this.size = 10;
this.damage = damage; // Bullet damage




}


update() {
this.position.add(this.velocity);
}


display() {
fill(255, 0, 0);
noStroke();
ellipse(this.position.x, this.position.y, this.size);
}


offscreen() {
return this.position.x < 0 || this.position.x > width || this.position.y < 0 || this.position.y > height;
}


checkCollision(enemy) {
let d = dist(this.position.x, this.position.y, enemy.position.x, enemy.position.y);
return d < this.size / 2 + enemy.size / 2;
}
}


class Enemy {
constructor(x, y) {
this.position = createVector(x, y);
this.size = 30;
this.speed = enemySpeed + player.level * 0.2; // Increase speed as player levels up
this.health = 3 + player.level; // Increase health based on player's level
}


update() {
let direction = createVector(player.position.x - this.position.x, player.position.y - this.position.y);
direction.normalize().mult(this.speed);
this.position.add(direction);
}


display() {
fill(255, 0, 255);
noStroke();
ellipse(this.position.x, this.position.y, this.size);
}


takeDamage(damage) {
this.health -= damage;
if (this.health <= 0) {
player.increaseXP(10); // Grant 10 XP for destroying this enemy
score += 10 + player.level*2;


  enemies.splice(enemies.indexOf(this), 1);  
}




}
}


class Boss {
constructor() {
this.position = createVector(random(width), random(height));
this.size = 50; // Size of the boss
this.speed = 1.5; // Speed of the boss (slower than enemies)
this.health = 50; // High health for the boss
this.damage = 100; // Damage dealt to the player
this.maxHealth = 50;
}


checkCollision(bullet) {
let d = dist(this.position.x, this.position.y, bullet.position.x, bullet.position.y);
return d < this.size / 2 + bullet.size / 2;
}


update() {
// Move towards the player
let direction = createVector(player.position.x - this.position.x, player.position.y - this.position.y);
direction.normalize().mult(this.speed);
this.position.add(direction);




// Ensure the boss stays within canvas bounds
this.position.x = constrain(this.position.x, this.size / 2, width - this.size / 2);
this.position.y = constrain(this.position.y, this.size / 2, height - this.size / 2);




}


display() {
fill(255, 0, 0); // Boss color
noStroke();
ellipse(this.position.x, this.position.y, this.size); // Draw the boss
}


takeDamage(damage) {
this.health -= damage;




// Check if the boss is defeated
if (this.health <= 0) {
  player.increaseXP(5000000000000); // Grant 50 XP for defeating the boss




score += 1000 + player.level*5;
  


  const bossIndex = bosses.indexOf(this);
  if (bossIndex >= 0) {
    bosses.splice(bossIndex, 1); // Remove the boss from the list
  } else {
    console.error("Attempted to remove a boss that doesn't exist in the array.");
  }
}




}


collideWithPlayer() {
const d = dist(this.position.x, this.position.y, player.position.x, player.position.y);
if (d < this.size / 2 + player.size / 2) {
player.health -= this.damage; // Deal damage to the player on collision
}
}
}


class ShootingEnemy {
constructor(x, y) {
this.position = createVector(x, y);
this.size = 30;
this.speed = enemySpeed + player.level * 0.2; // Increase speed based on player level
this.health = 3 + player.level; // Increase health based on player's level
this.lastShotTime = 0; // For shooting interval
this.shootInterval = 1500; // Time in ms between shots
this.bulletSpeed = 5;
this.bulletDamage = 1;
}


update() {
let direction = createVector(player.position.x - this.position.x, player.position.y - this.position.y);
direction.normalize().mult(this.speed);
this.position.add(direction);


// Shoot periodically
if (millis() - this.lastShotTime > this.shootInterval) {
  this.shoot();
  this.lastShotTime = millis();
}




}


display() {
fill(255, 0, 0); // Red color for shooting enemy
noStroke();
ellipse(this.position.x, this.position.y, this.size);
}


takeDamage(damage) {
this.health -= damage;
if (this.health <= 0) {
player.increaseXP(10); // Grant 10 XP for defeating this enemy
score += 10 + player.level*5;
enemies.splice(enemies.indexOf(this), 1);
}
}


shoot() {
let bullet = new EnemyBullet(this.position.x, this.position.y, player.position.x, player.position.y, this.bulletSpeed, this.bulletDamage);
enemyBullets.push(bullet);  // Push the bullet to a separate array for enemy bullets
}
}


// Handle shooting on mouse press
function mousePressed() {
player.shoot();
}


function gameOver() {
fill(0);
textSize(32);
textAlign(CENTER, CENTER);
text("GAME OVER", width / 2, height / 2);
textSize(16);
text("Score: " + score, width / 2, height / 2 + 40);


// Restart the game when 'R' is pressed
if (keyIsPressed && key === 'r') {
resetGame();
}
}


function resetGame() {
player = new Player();
bullets = [];
enemies = [];
bosses = [];
score = 0;
spawnInterval = 120;  // Reset spawn interval
lastBossLevel = 0;  // Reset boss spawn tracker
// Reset any other game state here
}


class EnemyBullet {
constructor(x, y, targetX, targetY, speed, damage) {
this.position = createVector(x, y);
this.velocity = createVector(targetX - x, targetY - y);
this.velocity.normalize().mult(speed);
this.size = 10;
this.damage = 5;
}


update() {
this.position.add(this.velocity);
}


display() {
fill(255, 165, 0); // Orange color for enemy bullets
noStroke();
ellipse(this.position.x, this.position.y, this.size);
}


offscreen() {
return this.position.x < 0 || this.position.x > width || this.position.y < 0 || this.position.y > height;
}


checkCollision(player) {
let d = dist(this.position.x, this.position.y, player.position.x, player.position.y);
return d < this.size / 2 + player.size / 2;
}
}


function displayHealthBar() {
fill(255, 0, 0);  // Red color for health bar
noStroke();
let barWidth = 200;  // Width of the health bar
let barHeight = 20;  // Height of the health bar
let healthPercentage = player.health / 100;  // Health percentage (assuming max health is 100)


// Draw the health bar background
fill(100);
rect(10, height - barHeight - 10, barWidth, barHeight);


// Draw the health bar foreground (based on the player's current health)
fill(255, 0, 0);  // Red color for the health bar fill
rect(10, height - barHeight - 10, barWidth * healthPercentage, barHeight);
}


class Slash {
constructor(x, y, angle) {
this.x = x;
this.y = y;
this.angle = angle;
this.size = 70;
this.duration = 200; // in ms
this.createdAt = millis();
}


update() {
return millis() - this.createdAt > this.duration;
}


display() {
push();
translate(this.x, this.y);
rotate(this.angle);
fill(255, 255, 0, 150);
noStroke();
arc(0, 0, this.size, this.size, -PI / 4, PI / 4, PIE);
pop();
}
}


function displayBossHealthBar(boss) {
let barWidth = 200;
let healthPercentage = boss.health / boss.maxHealth;
fill(255, 0, 0);
rect(230, 40, barWidth, 20);
fill(0, 255, 0);
rect(230, 40, barWidth * healthPercentage, 20);
}


function displayMeleeCooldown() {
let cooldownRatio = constrain((millis() - player.lastMeleeTime) / player.meleeCooldown, 0, 1);
fill(150);
rect(10, height - 40, 100, 10);
fill(0, 255, 0);
rect(10, height - 40, 100 * cooldownRatio, 10);
}


function keyPressed() {
  if (key === 'p' || key === 'P') {
    isPaused = !isPaused;
  }
  if (key === 'r' || key === 'R') {
    if (player.health <= 0) {
      resetGame();
    }
  }
  if (droneChoicePending) {
    if (key === '1') {
      player.drones.push(new AceDrone(player, 0)); // Ace Drone
      droneChoicePending = false;
      loop(); // Resume the game
    } else if (key === '2') {
      player.drones.push(new LaserDrone(player, 0)); // Laser Drone
      droneChoicePending = false;
      loop(); // Resume the game
    } else if (key === '3') {
      player.drones.push(new AOEDrone(player, 0)); // AOE Drone
      droneChoicePending = false;
      loop(); // Resume the game
    }
  }
}




function spawnEnemy() {
let x, y;
do {
x = random(width);
y = random(height);
} while (dist(x, y, player.position.x, player.position.y) < 100);


if (random() < 0.5) {
enemies.push(new Enemy(x, y));
} else {
enemies.push(new ShootingEnemy(x, y));
}
}


class Drone {
  constructor(player, angleOffset = 0) {
    this.player = player;
    this.orbitRadius = 50;
    this.angle = angleOffset;
    this.angleOffset = angleOffset; // Store initial offset
    this.size = 15;
    this.fireRate = 500;
    this.lastShotTime = 0;
    this.bulletSpeed = 4;
    this.bulletDamage = 1;
    this.isAOE = false;
  }


  update() {
    this.angle += 0.03;
    this.position = createVector(
      this.player.position.x + this.orbitRadius * cos(this.angle),
      this.player.position.y + this.orbitRadius * sin(this.angle)
    );


    if (millis() - this.lastShotTime > this.fireRate && enemies.length > 0) {
      let target = this.getClosestEnemy();
      if (target) {
        if (this.isAOE) {
          let d = dist(this.position.x, this.position.y, target.position.x, target.position.y);
          if (d < 30) {
            aoeExplosions.push(new AOEExplosion(this.position.x, this.position.y, 60, 3)); // AOE: 60px radius, 3 damage
            this.lastShotTime = millis();
          }
        } else {
          let bullet = new Bullet(
            this.position.x, this.position.y,
            target.position.x, target.position.y,
            this.bulletSpeed,
            this.bulletDamage
          );
          bullets.push(bullet);
          this.lastShotTime = millis();
        }
      }
    }
  }


  display() {
    fill(0, 200, 255);
    ellipse(this.position.x, this.position.y, this.size);
  }


  getClosestEnemy() {
    let closest = null;
    let minDist = Infinity;
    for (let enemy of enemies) {
      let d = dist(this.position.x, this.position.y, enemy.position.x, enemy.position.y);
      if (d < minDist) {
        closest = enemy;
        minDist = d;
      }
    }
    return closest;
  }
}




class AOEExplosion {
  constructor(x, y, radius, damage) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.damage = damage;
    this.createdAt = millis();
    this.duration = 300; // visual effect duration
  }


  update() {
    for (let enemy of enemies) {
      let d = dist(this.x, this.y, enemy.position.x, enemy.position.y);
      if (d < this.radius) {
        enemy.takeDamage(this.damage);
      }
    }
  }


  display() {
    let elapsed = millis() - this.createdAt;
    if (elapsed < this.duration) {
      fill(255, 150, 0, 150);
      noStroke();
      ellipse(this.x, this.y, this.radius * 2);
    }
  }


  isExpired() {
    return millis() - this.createdAt > this.duration;
  }
}


class AceDrone extends Drone {
  constructor(player, angleOffset = 0) {
    super(player, angleOffset);
    this.fireRate = 100; // Very fast
    this.bulletSpeed = 6;
    this.bulletDamage = 1;
  }
}


class LaserDrone extends Drone {
  constructor(player, angleOffset = 0) {
    super(player, angleOffset);
    this.fireRate = 0; // Constant beam
    this.beamLength = 100000;
    this.damagePerSecond = 1;
  }


  update() {
    super.update();


    let target = this.getClosestEnemy();
    if (target) {
      let d = dist(this.position.x, this.position.y, target.position.x, target.position.y);
      if (d < this.beamLength) {
        target.takeDamage(this.damagePerSecond * (deltaTime / 1000)); // scale by time
        this.target = target;
      } else {
        this.target = null;
      }
    }
  }


  display() {
    super.display();


    if (this.target) {
      stroke(0, 255, 255);
      strokeWeight(2);
      line(this.position.x, this.position.y, this.target.position.x, this.target.position.y);
    }
  }
}


class AOEDrone extends Drone {
  constructor(player, angleOffset = 0) {
    super(player, angleOffset);
    this.fireRate = 1000; // Fire rate for AOE Drone
    this.isAOE = true; // Mark this drone as AOE
    this.radius = 60; // Explosion radius
    this.damage = 3;  // Damage dealt by the AOE explosion
  }


  update() {
    this.angle += 0.03;
    this.position = createVector(
      this.player.position.x + this.orbitRadius * cos(this.angle),
      this.player.position.y + this.orbitRadius * sin(this.angle)
    );


    if (millis() - this.lastShotTime > this.fireRate && enemies.length > 0) {
      let target = this.getClosestEnemy();
      if (target) {
        let d = dist(this.position.x, this.position.y, target.position.x, target.position.y);
        if (d < this.radius) {
          aoeExplosions.push(new AOEExplosion(this.position.x, this.position.y, this.radius, this.damage));
          this.lastShotTime = millis();
        }
      }
    }
  }


  display() {
    fill(255, 0, 255);
    ellipse(this.position.x, this.position.y, this.size);
  }
}
