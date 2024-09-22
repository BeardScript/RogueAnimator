import * as RE from 'rogue-engine';
import * as THREE from 'three';

const v0 = new THREE.Vector3();

@RE.registerComponent
export default class RogueAnimator extends RE.Component {
  @RE.props.map.animation()
  clips: Record<string, THREE.AnimationClip> = {};

  actions: Record<string, THREE.AnimationAction> = {};
  activeAction: THREE.AnimationAction;

  get animations() {
    return this.isReady ? Object.values(this.clips) : [];
  }

  private _selected = 0;

  @RE.props.select()
  get selected() {
    this.selectedOptions = Object.keys(this.clips);
    this.isReady && this.animationsHaveChanged() && this.updateConfigs();

    return this._selected;
  }

  set selected(value: number) {
    this._selected = value;
    this.activeAction && this.activeAction.reset();
    this.animationsHaveChanged() && this.updateConfigs();
    if (this.playLabel === "Stop" && !RE.Runtime.isRunning) {
      this.playAction();
    }
  }

  selectedOptions: string[] = Object.keys(this.clips);

  get selectedAction() {
    const actionName = this.selectedOptions[this.selected];
    return this.actions[actionName];
  }

  private stopAction() {
    this.selectedAction?.reset();
    this.mixer.stopAllAction();
  }

  private playAction() {
    this.stopAction();
    this.playLabel = "Stop";
    if (!this.selectedAction) return;

    this.selectedAction.play();
  }

  editorUpdate: {stop: () => void} | undefined;

  playLabel = "Play";

  @RE.props.button()
  play() {
    if (RE.Runtime.isRunning) return;

    if (this.playLabel === "Play" && !this.editorUpdate) {
      this.mixer;
      this.animationsHaveChanged() && this.updateConfigs();
      this.playAction();
      const rootBone = this.getRootBone();
      const originalPos = rootBone?.position.clone();
      this.editorUpdate = RE.onUpdate(sceneController => {
        if (sceneController === RE.Runtime) return;
        if (this.animationsHaveChanged()) {
          this.stopAction();
          this.updateConfigs();
        }
        this.mixer.update(sceneController.deltaTime);
        originalPos && rootBone?.position.copy(originalPos);
      });
    }

    else {
      this.playLabel = "Play";
      this.stopAction();
      this.editorUpdate?.stop();
      this.editorUpdate = undefined;
    }
  }

  private stopped = false;
  private stopping = false;

  get isActive() {
    return !this.stopped && !this.stopping;
  }

  stop() {
    this.stopping = true;
  }

  resume() {
    this.stopped = false;
    this.stopping = false;
  }

  private _mixer: THREE.AnimationMixer;

  get mixer() {
    if (!this._mixer) {
      this._mixer = new THREE.AnimationMixer(this.object3d);
      this.actions = {};
      for (let key in this.clips) {
        let clip = this.clips[key];
        this.actions[key] = clip ? new THREE.AnimationAction(this._mixer, clip) : undefined as any;
      }
    }

    return this._mixer;
  }

  private animationsHaveChanged() {
    if (this.selectedOptions.length !== this.animations.length) return true;
    const keys = Object.keys(this.clips);
    for (let i = 0; i < this.selectedOptions.length; i++) {
      if (this.selectedOptions[i] !== keys[i]) return true;
      if (this.actions[keys[i]]) {
        if (this.actions[keys[i]].getClip() !== this.clips[keys[i]]) return true;
      } else {
        if (this.clips[keys[i]]) return true;
      }
    }

    return false;
  }

  private updateConfigs() {
    this._mixer = undefined as any;
    this.mixer;
  }

  private _baseAction: THREE.AnimationAction;

  get baseAction() {
    if (!this._baseAction) this._baseAction = Object.values(this.actions)[0];
    return this._baseAction;
  }

  set baseAction(action: THREE.AnimationAction) {
    this._baseAction = action;
  }

  setBaseAction(actionName: string) {
    this._baseAction = this.getAction(actionName);
  }

  setWeight(action: THREE.AnimationAction | string, weight: number) {
    if (typeof action === "string") {
      action = this.getAction(action);
    }

    action?.setEffectiveWeight(weight);
  }

  getAction(name: string) {
    return this.actions[name];
  }

  getWeight(action: THREE.AnimationAction | string) {
    if (typeof action === "string") {
      action = this.getAction(action);
    }

    return action?.getEffectiveWeight() | 0;
  }

  mix(actionName: string, transitionTime: number = 0.1, weight = 1, warp = true) {
    const action = this.getAction(actionName);

    if (!action) return;

    if (action === this.activeAction) {
      action.setEffectiveWeight(weight);
      if (weight < 1) {
        this.baseAction.enabled = true;
        this.baseAction.setEffectiveTimeScale(1);
        this.baseAction?.setEffectiveWeight(1 - weight);
      }
      return;
    }

    action.reset();

    if (!this.activeAction) {
      this.activeAction = action;
    }

    this.activeAction.enabled = true;
    action.enabled = true;

    if (weight >= 0.8) {
      this.setWeight(this.baseAction, 0);
    }

    action.crossFadeFrom(this.activeAction, transitionTime, warp);
    this.setWeight(action, weight);

    this.baseAction = this.activeAction;
    this.activeAction = action;
  }

  getRootBone() {
    return this.findRootBone(this.object3d) as THREE.Bone;
  }

  private findRootBone(object: THREE.Object3D): THREE.Bone | undefined {
    if (object instanceof THREE.Bone) {
      return object;
    }

    for (let child of object.children) {
      const skeleton = this.findRootBone(child);
      if (skeleton) return skeleton;
    }

    return;
  }

  private animationFinishedListeners: (() => void)[] = [];

  onAnimationFinished(cb: () => void) {
    this.animationFinishedListeners.push(cb);
  }

  private animationFinished = () => {
    if (this.stopping) {
      this.stopped = true;
      this.stopping = false;
    }

    this.animationFinishedListeners.forEach(listener => listener());

    if (this.activeAction.loop === THREE.LoopOnce && !this.activeAction.clampWhenFinished) {
      this.mix(Object.keys(this.actions)[0], 0.1, 1, false);
    }
  }

  awake() {
    this.editorUpdate?.stop();
    this.editorUpdate = undefined;
  }

  start() {
    this.updateConfigs();
    this.mixer.existingAction(this.animations[this.selected])?.reset();
    this.mixer.stopAllAction();

    Object.values(this.actions).forEach((action, i) => {
      if (!action) return;
      action.play();
      this.setWeight(action, 0);
    });

    this.mixer.removeEventListener("finished", this.animationFinished);
    this.mixer.addEventListener("finished", this.animationFinished);

    const actionName = Object.keys(this.actions)[0];
    this.mix(actionName);
  }

  update() {
    const rootBone = this.getRootBone();
    let pos = v0;

    if (rootBone) {
      pos = rootBone.position.clone();
    }
    
    this.mixer.update(RE.Runtime.deltaTime);
    
    if (rootBone) {
      rootBone.position.x = pos.x;
      rootBone.position.z = pos.z;
    }
  }
}
