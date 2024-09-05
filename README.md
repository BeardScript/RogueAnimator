# Rogue Animator 
*rogue-animator*

This is a package for [Rogue Engine](https://rogueengine.io/). You should install it in your project from the Marketplace within the editor.

This package contains the **RogueAnimator** component. A simple solution to help you load and mix animations, using the threejs Animation Mixer.

## Instructions

Add the **RogueAnimator** component to a rigged mesh object or its parent. It doesn't need to be the direct parent.

Expand the clips list in the inspector and add as many fields as you need.

Click on the field label to edit the name of the animation and drop the corresponding clips.

Use the dropdown to select a clip and hit **Play** to see it running. Hit the **Stop** before playing your scene.

The component will create a **THREE.AnimationAction** for each one of your clips.

In your code, use `RogueAnimator.mix("name")` to set the main animation. You can use `RogueAnimator.getAction("name")` to get access to a **THREE.AnimationAction** in your component.

You can also set the weight of other animations to blend them with the main one being played by the **THREE.AnimationMixer**.

## API

#### Properties

**mixer: THREE.AnimationMixer**

The instance of the AnimationMixer used by the component.

**actions: Record<string, THREE.AnimationAction>**

An object map containing all the Animation Actions in this component.

**activeAction: THREE.AnimationAction**

This is the current main animation being played.

**baseAction: THREE.AnimationAction**

The action from which we're mixing. By default it's set to the last animation we've mixed from. It's especially relevant when mixing with a weight smaller than 1.

#### Methods

**mix(actionName: string, transitionTime: number = 0.1, weight = 1, warp = true)**

Use this method to mix your animations. This sets the active animation and allows you to define a specific transition time, and a weight between 0 and 1.

**getAction(name: string)**

Returns the action with the given name, as provided at the clips list in the inspector.

**getRootBone()**

Returns the root bone of your skeleton
