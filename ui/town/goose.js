import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const ROLE_COLORS = {
  orchestrator: 0xffd700,  // gold
  researcher:   0x4fc3f7,  // light blue
  worker:       0xff8a65,  // orange
  reviewer:     0xce93d8,  // purple
  writer:       0xa5d6a7,  // green
  generic:      0xf5f0e8,  // off-white
};

// Shared GLTF data promise (loaded once, cloned per goose)
let sharedModelPromise = null;

function loadSharedModel() {
  if (sharedModelPromise) return sharedModelPromise;
  sharedModelPromise = new Promise((resolve) => {
    const loader = new GLTFLoader();
    loader.load(
      '/ui/town/assets/goose.glb',
      (gltf) => {
        console.log('[Goose] GLB loaded — animations:', gltf.animations.map(a => `${a.name} (${a.duration.toFixed(2)}s)`));
        resolve({ scene: gltf.scene, animations: gltf.animations });
      },
      undefined,
      () => resolve(null)  // fallback to procedural on error
    );
  });
  return sharedModelPromise;
}

// Fallback procedural goose if GLB fails to load
function buildProceduralGoose(color) {
  const mat = new THREE.MeshBasicMaterial({ color });
  const g = new THREE.Group();
  // Body
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), mat);
  body.scale.set(1, 0.75, 1.25); body.position.y = 0.28; g.add(body);
  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.32, 8), mat);
  neck.position.set(0, 0.56, 0.18); neck.rotation.x = -0.35; g.add(neck);
  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), mat);
  head.position.set(0, 0.76, 0.32); g.add(head);
  // Beak
  const beak = new THREE.Mesh(
    new THREE.ConeGeometry(0.045, 0.16, 6),
    new THREE.MeshBasicMaterial({ color: 0xe8a020 })
  );
  beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.74, 0.5); g.add(beak);
  // Wings (flat boxes)
  [-1, 1].forEach(side => {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.3), mat);
    wing.position.set(side * 0.3, 0.3, 0); wing.rotation.z = side * 0.3; g.add(wing);
  });
  return g;
}

export class Goose {
  constructor({ id, role, gtwall_id, scene, boardPosition }) {
    this.id = id;
    this.role = role;
    this.gtwall_id = gtwall_id;
    this.scene = scene;
    this.boardPosition = boardPosition;  // Vector3 of bulletin board

    this.state = 'idle';
    this.status = 'idle';
    this.inPen = false;
    this.penBounds = null;
    this.tokens = 0;
    this.messageCount = 0;
    this.sessionId = null;

    // Assign home position on a ring (set by TownScene after construction)
    this.homePosition = new THREE.Vector3();
    this.targetPosition = new THREE.Vector3();
    this.wanderTimer = Math.random() * 10;

    this.mesh = new THREE.Group();
    this.mixer = null;
    this.walkAction = null;
    scene.add(this.mesh);

    // Name label (sprite)
    this._buildLabel();

    // Load model async
    this._loadModel();
  }

  async _loadModel() {
    try {
      const shared = await loadSharedModel();
      if (shared) {
        this.gooseMesh = SkeletonUtils.clone(shared.scene);
        // Deep-clone materials so tinting one goose doesn't affect others
        this.gooseMesh.traverse(obj => {
          if (obj.isMesh && obj.material) {
            obj.material = obj.material.clone();
          }
        });
        this.gooseMesh.scale.setScalar(0.5);

        // Set up animation mixer if the GLB has animations
        if (shared.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(this.gooseMesh);
          // Find a walk animation (try common names, fall back to first clip)
          const walkClip = shared.animations.find(a => /walk/i.test(a.name))
            || shared.animations[0];
          if (walkClip) {
            this.walkAction = this.mixer.clipAction(walkClip);
            this.walkAction.loop = THREE.LoopRepeat;
            this.walkClipDuration = walkClip.duration;
            console.log(`[Goose] walk clip: "${walkClip.name}" duration=${walkClip.duration.toFixed(2)}s`);
          }
        }
      } else {
        this.gooseMesh = buildProceduralGoose(ROLE_COLORS[this.role] ?? 0xf5f0e8);
      }
    } catch (err) {
      console.warn(`[Goose ${this.gtwall_id}] model load error, using procedural:`, err);
      this.gooseMesh = buildProceduralGoose(ROLE_COLORS[this.role] ?? 0xf5f0e8);
    }
    this.mesh.add(this.gooseMesh);
    // Re-sync position (setHome may have been called while we were loading)
    this.mesh.position.copy(this.homePosition);
    this.targetPosition.copy(this.homePosition);
    // Apply any status tint that arrived while loading
    this._applyStatusTint();
  }

  _buildLabel() {
    // Canvas texture label showing gtwall_id
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 48;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, 256, 48);
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = '#ffb347';
    ctx.textAlign = 'center';
    ctx.fillText(this.gtwall_id || this.role, 128, 32);
    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    sprite.position.y = 1.4;
    sprite.scale.set(2, 0.4, 1);
    this.mesh.add(sprite);
    this.labelSprite = sprite;
  }

  setHome(position) {
    this.homePosition.copy(position);
    this.targetPosition.copy(position);
    if (this.mesh) this.mesh.position.copy(position);
  }

  // Called by TownScene on SSE tree update
  updateFromTree(data) {
    this.status = data.status;
    this.tokens = data.tokens ?? 0;
    this.messageCount = data.message_count ?? 0;
    this.sessionId = data.id;
    if (data.gtwall_id) this.gtwall_id = data.gtwall_id;
    // Color the mesh on status change
    this._applyStatusTint();
  }

  _applyStatusTint() {
    if (!this.gooseMesh) return;
    // Store original colors on first call
    if (!this._origColors) {
      this._origColors = [];
      this.gooseMesh.traverse(obj => {
        if (obj.isMesh && obj.material) {
          this._origColors.push({ mesh: obj, color: obj.material.color.getHex() });
        }
      });
    }
    this.gooseMesh.traverse(obj => {
      if (obj.isMesh && obj.material) {
        const orig = this._origColors.find(o => o.mesh === obj);
        if (this.status === 'error') {
          obj.material.color.setHex(0xcc4444);
        } else if (this.status === 'complete') {
          // Desaturate toward light warm tone (visible on dark ground)
          const c = new THREE.Color(orig ? orig.color : 0xf5f0e8);
          c.lerp(new THREE.Color(0xccbbaa), 0.4);
          obj.material.color.copy(c);
        } else if (orig) {
          obj.material.color.setHex(orig.color);
        }
      }
    });
  }

  sendToPen(penCenter, penBounds) {
    this.inPen = true;
    this.penBounds = penBounds;
    const x = penBounds.xMin + 0.5 + Math.random() * (penBounds.xMax - penBounds.xMin - 1);
    const z = penBounds.zMin + 0.5 + Math.random() * (penBounds.zMax - penBounds.zMin - 1);
    this.homePosition.set(x, 0, z);
    this.targetPosition.copy(this.homePosition);
    this.state = 'walking';
    this._pendingBoardAction = null;
  }

  // Trigger animations
  goPost(onArrive) { this._goToBoard('posting', onArrive); }
  goRead() { this._goToBoard('reading'); }

  _goToBoard(actionState, onArrive) {
    if (this.state === 'posting' || this.state === 'reading') return;
    this.state = 'walking';
    this._pendingBoardAction = actionState;
    this._onBoardArrive = onArrive || null;
    // Each goose gets a slightly different approach point so they don't stack
    const offset = new THREE.Vector3(
      (Math.random() - 0.5) * 0.8,
      0,
      (Math.random() - 0.5) * 0.4 + 0.8
    );
    this.targetPosition.copy(this.boardPosition).add(offset);
  }

  goHome() {
    this.state = 'walking';
    this._pendingBoardAction = null;
    // Wander to a random spot near home
    this.targetPosition.copy(this.homePosition).add(
      new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2)
    );
  }

  // dt in seconds
  update(dt) {
    if (!this.gooseMesh) return;
    const t = performance.now() / 1000;

    const dist = this.mesh.position.distanceTo(this.targetPosition);
    const moving = dist > 0.05;
    const speed = 1.5;

    if (moving) {
      // Start walk animation if not already playing
      if (this.walkAction && !this._walkPlaying) {
        this.walkAction.reset().fadeIn(0.15).play();
        // Scale animation speed to match movement speed.
        // Assume the clip was authored for ~1 unit/sec stride; adjust to taste.
        if (this.walkClipDuration) {
          this.walkAction.timeScale = speed * 0.5;
        }
        this._walkPlaying = true;
      }
      // Walk toward target (clamp step to remaining distance to avoid overshoot)
      const step = Math.min(speed * dt, dist);
      const dir = this.targetPosition.clone().sub(this.mesh.position).normalize();
      this.mesh.position.addScaledVector(dir, step);
      // Face direction of travel
      // Add Math.PI if the model's forward is -Z (common in Blender exports)
      this.mesh.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI;
    } else {
      // Stop walk animation
      if (this.walkAction && this._walkPlaying) {
        this.walkAction.fadeOut(0.3);
        this._walkPlaying = false;
      }

      if (this.state === 'walking') {
        if (this._pendingBoardAction) {
          this.state = this._pendingBoardAction;
          this._boardTimer = this.state === 'posting' ? 2.5 : 3.5;
          // Face the board
          const toBoard = this.boardPosition.clone().sub(this.mesh.position);
          this.mesh.rotation.y = Math.atan2(toBoard.x, toBoard.z) + Math.PI;
          // Fire arrival callback (e.g. to render wall message)
          if (this._onBoardArrive) {
            this._onBoardArrive();
            this._onBoardArrive = null;
          }
        } else {
          this.state = 'idle';
        }
      }
    }

    // Advance animation mixer (after play/stop decisions)
    if (this.mixer) this.mixer.update(dt);

    // At-board timer
    if ((this.state === 'posting' || this.state === 'reading') && !moving) {
      // Head-bob reading animation
      if (this.gooseMesh.children[2]) {  // head node (index 2 in procedural)
        this.gooseMesh.children[2].rotation.x = Math.sin(t * 2) * 0.15;
      }
      this._boardTimer -= dt;
      if (this._boardTimer <= 0) {
        this.goHome();
      }
    }

    // Idle head sway
    if (this.state === 'idle') {
      if (this.gooseMesh.children[2]) {
        this.gooseMesh.children[2].rotation.y = Math.sin(t * 0.8) * 0.15;
      }
    }

    // Complete: stay put (no drift — keep them visible)
    // TODO: re-enable edge drift once we have a proper fade-out animation

    // Error: shake
    if (this.status === 'error') {
      this.mesh.position.x += Math.sin(t * 20) * 0.003;
    }

    // Random wander
    if (this.state === 'idle') {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        if (this.inPen && this.penBounds) {
          // Lazy pen wander — smaller radius, longer timer
          this.wanderTimer = 5 + Math.random() * 8;
          const b = this.penBounds;
          const x = Math.max(b.xMin + 0.3, Math.min(b.xMax - 0.3,
            this.homePosition.x + (Math.random() - 0.5) * 1.5));
          const z = Math.max(b.zMin + 0.3, Math.min(b.zMax - 0.3,
            this.homePosition.z + (Math.random() - 0.5) * 1.5));
          this.targetPosition.set(x, 0, z);
          this.state = 'walking';
        } else if (this.status !== 'complete') {
          this.wanderTimer = 8 + Math.random() * 12;
          this.state = 'walking';
          this.targetPosition.copy(this.homePosition).add(
            new THREE.Vector3((Math.random() - 0.5) * 2.5, 0, (Math.random() - 0.5) * 2.5)
          );
        }
      }
    }
  }

  dispose() {
    this.scene.remove(this.mesh);
  }
}
