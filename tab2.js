



// Code taken from Golan Levin's template: https://openprocessing.org/sketch/2059071

// Original copyright:
// Copyright (c) 2023 ml5
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT
// Originally from https://editor.p5js.org/ml5/sketches/QGH3dwJ1A
// Requires: https://unpkg.com/ml5@0.20.0-alpha.3/dist/ml5.js
let zigProgress = 0
let w = 1620
let h = 1080
let mw = 640
let mh = 480
let wratio = w/mw
let hratio = h/mh
let handTracker;
let grabbables = [];
let zig = [];
let zstart;
let zigmode = false;

let handpose;
let video;
let hands = [];
let hand = [];
let bodyGrabbablesData = null;
let interactionModel = null;
let globalPinchGeneration = 0;
let options = { maxHands: 2, flipHorizontal: true };
let grabRenderCounter = 0;
let s = 15
const TRACKING_OVERFLOW_SCALE_X = 1.25;
const TRACKING_OVERFLOW_SCALE_Y = 1.2;
const HAND_MAX = 2;
const PINCH_CLOSE_RATIO = 0.3;
const PINCH_OPEN_RATIO = 0.62;
const PINCH_HOLD_FRAMES = 2;
const HAND_SMOOTH_ALPHA = 0.58;
const MAX_TRACK_JUMP = 130;
const MAX_MISSED_FRAMES = 10;
const HOME_RIGHT_OFFSET_X = 170;
const HOME_LEFT_OFFSET_X = -170;
const HOME_OFFSET_Y = 40;
const OFFSCREEN_MARGIN_X = 220;
const OFFSCREEN_MARGIN_Y = 220;
const OFFSCREEN_RETREAT_FRAMES = 60;
const OFFSCREEN_ARC_BOW = 70;
const HAND_STALE_MS = 120;
const RECONNECT_GRAB_COOLDOWN_FRAMES = 8;
const GRAB_RANGE_SCALE = 0.7;
const THROW_DECEL = 0.72;
const THROW_SMALL_THRESHOLD = 12.2;
const THROW_BIG_THRESHOLD = 30.2;
const THROW_SMALL_SPEED = 50.0;
const THROW_BIG_SPEED = 140.0;
const THROW_SPIN_DAMP = 0.75;
const THROW_VELOCITY_HISTORY_SIZE = 5;
const THROW_TIER_OLDEST_SAMPLE_COUNT = 4;
const PICKUP_TO_OBJECT_LERP = 0.45;
const PICKUP_RETURN_LERP = 0.28;
const PICKUP_ATTACH_DIST = 10;
const PICKUP_RETURN_DIST = 12;
const CLAW_PICKUP_SHRINK_SCALE = 0.82;
const CLAW_SCALE_LERP = 0.3;
const TOOL_RIGHT_ANGLE = -45;
const TOOL_LEFT_ANGLE = 45;
const TOOL_INTERACTION_RADIUS_FACTOR = 1.0;
const TOOL_TIP_AXIS_OFFSET_DEG = -90;
const CUT_COOLDOWN_FRAMES = 10;
const CUT_SUSTAIN_FRAMES_SCALPEL = 5;
const CUT_SUSTAIN_FRAMES_BONESAW = 8;
const CUT_SUSTAIN_FRAMES_HAMMER = 8;
const CUT_SCALPEL_MIN_SPEED = 4;
const CUT_SCALPEL_MAX_SPEED = 10;
const CUT_BONESAW_MIN_SPEED = 10;
const CUT_HAMMER_MIN_SPEED = 15;

function vdist(p1,p2){
	return dist(p1.x,p1.y,p2.x,p2.y)
}
function vadd(p1,p2){
	return createVector(p1.x+p2.x,p1.y+p2.y)
}
function mid(p1,p2){
	return createVector((p1.x+p2.x)/2,(p1.y+p2.y)/2)
}
function mapTrackedPoint(rawX, rawY){
	const baseX = rawX * wratio;
	const baseY = rawY * hratio;
	const cx = w / 2;
	const cy = h / 2;
	return createVector(
		(baseX - cx) * TRACKING_OVERFLOW_SCALE_X + cx,
		(baseY - cy) * TRACKING_OVERFLOW_SCALE_Y + cy
	);
}
function getWindowScaleFactor() {
	return max(0.1, min(windowWidth / w, windowHeight / h));
}
function scaleDistanceForWindow(baseDistance) {
	return baseDistance / getWindowScaleFactor();
}
function scaleSpeedForWindow(baseSpeed) {
	return baseSpeed / getWindowScaleFactor();
}
function getHomePinch(side){
	const cx = w / 2;
	const cy = h / 2;
	if (side === "left") {
		return createVector(cx + HOME_LEFT_OFFSET_X, cy + HOME_OFFSET_Y);
	}
	return createVector(cx + HOME_RIGHT_OFFSET_X, cy + HOME_OFFSET_Y);
}
function getOffscreenPinch(side){
	if (side === "left") {
		return createVector(-OFFSCREEN_MARGIN_X, h + OFFSCREEN_MARGIN_Y);
	}
	return createVector(w + OFFSCREEN_MARGIN_X, h + OFFSCREEN_MARGIN_Y);
}
function inferHandSide(hand){
	if (hand && typeof hand.handedness === "string") {
		const side = hand.handedness.toLowerCase();
		if (side === "left" || side === "right") return side;
	}
	if (hand && hand.handedness && hand.handedness.label) {
		const side = String(hand.handedness.label).toLowerCase();
		if (side === "left" || side === "right") return side;
	}
	if (hand && Array.isArray(hand.handednesses) && hand.handednesses.length > 0) {
		const label = String(hand.handednesses[0]?.label || hand.handednesses[0]?.categoryName || "").toLowerCase();
		if (label === "left" || label === "right") return label;
	}
	// Fallback heuristic for mirrored webcam feeds.
	const thumb = hand.keypoints?.[ML5HAND_THUMB_TIP];
	const index = hand.keypoints?.[ML5HAND_INDEX_FINGER_TIP];
	if (thumb && index) {
		return thumb.x > index.x ? "left" : "right";
	}
	return "right";
}

function createInteractionModel() {
	return {
		itemsById: new Map(),
		hitboxesById: new Map(),
		bodyItemIds: new Map(),
		bodyHitboxIds: new Map(),
		rulesByItemId: new Map(),
		grabbableIndexByHitboxId: new Map()
	};
}

function resetInteractionModel() {
	interactionModel = createInteractionModel();
}

function getOrCreateModelItem(bodyKey, itemId, def) {
	if (!interactionModel.itemsById.has(itemId)) {
		interactionModel.itemsById.set(itemId, {
			id: itemId,
			bodyKey: bodyKey,
			state: def.initialState || "default",
			picKey: def.picKey || null,
			flags: { hasBeenInteracted: false },
			hitboxIds: [],
			ruleIds: []
		});
	}
	if (!interactionModel.bodyItemIds.has(bodyKey)) {
		interactionModel.bodyItemIds.set(bodyKey, []);
	}
	const bodyItemIds = interactionModel.bodyItemIds.get(bodyKey);
	if (!bodyItemIds.includes(itemId)) {
		bodyItemIds.push(itemId);
	}
	return interactionModel.itemsById.get(itemId);
}

function registerModelHitbox(bodyKey, itemDef, hitboxDef, id, g, grabbableIndex) {
	if (!interactionModel) {
		resetInteractionModel();
	}
	const itemId = itemDef.itemId || hitboxDef.itemId || hitboxDef.idName;
	const hitboxId = hitboxDef.hitboxId || hitboxDef.idName;
	const item = getOrCreateModelItem(bodyKey, itemId, itemDef);
	const hitbox = {
		id: hitboxId,
		itemId: itemId,
		bodyKey: bodyKey,
		itemCode: id,
		mode: hitboxDef.mode || "grab",
		grabbableIndex: grabbableIndex,
		radius: hitboxDef.radius,
		center: { x: hitboxDef.x, y: hitboxDef.y },
		enabled: true,
		picKey: hitboxDef.picKey || itemDef.picKey || null,
		isPlaceholder: (hitboxDef.picKey || itemDef.picKey || null) == null,
		consumeOnInteract: !!hitboxDef.consumeOnInteract,
		revealHidden: !!hitboxDef.revealHidden,
		interactionMode: hitboxDef.interactionMode || null,
		requiredTool: hitboxDef.requiredTool || null,
		cutCooldownFrames: hitboxDef.cutCooldownFrames || CUT_COOLDOWN_FRAMES,
		requireFlagsTrue: Array.isArray(hitboxDef.requireFlagsTrue) ? hitboxDef.requireFlagsTrue : [],
		onRequirementFail: hitboxDef.onRequirementFail || null,
		clearScalpelInUse: !!hitboxDef.clearScalpelInUse,
		revealHitboxIds: Array.isArray(hitboxDef.revealHitboxIds) ? hitboxDef.revealHitboxIds : [],
		hideHitboxIds: Array.isArray(hitboxDef.hideHitboxIds) ? hitboxDef.hideHitboxIds : [],
		rules: Array.isArray(hitboxDef.rules) ? hitboxDef.rules : []
	};
	interactionModel.hitboxesById.set(hitboxId, hitbox);
	interactionModel.grabbableIndexByHitboxId.set(hitboxId, grabbableIndex);
	item.hitboxIds.push(hitboxId);

	if (!interactionModel.bodyHitboxIds.has(bodyKey)) {
		interactionModel.bodyHitboxIds.set(bodyKey, []);
	}
	interactionModel.bodyHitboxIds.get(bodyKey).push(hitboxId);

	const ruleDefs = Array.isArray(hitboxDef.rules) ? hitboxDef.rules : [];
	for (let i = 0; i < ruleDefs.length; i++) {
		const ruleId = ruleDefs[i].id || `${itemId}_rule_${i}`;
		if (!interactionModel.rulesByItemId.has(itemId)) {
			interactionModel.rulesByItemId.set(itemId, []);
		}
		interactionModel.rulesByItemId.get(itemId).push({
			id: ruleId,
			itemId: itemId,
			definition: ruleDefs[i]
		});
		item.ruleIds.push(ruleId);
	}

	// Back-reference for compatibility while we migrate logic in later steps.
	g.modelItemId = itemId;
	g.modelHitboxId = hitboxId;
	g.isConsumed = false;
}

function getModelHitboxesForItem(itemId) {
	if (!interactionModel || !interactionModel.itemsById.has(itemId)) {
		return [];
	}
	const item = interactionModel.itemsById.get(itemId);
	const out = [];
	for (let i = 0; i < item.hitboxIds.length; i++) {
		const hb = interactionModel.hitboxesById.get(item.hitboxIds[i]);
		if (hb) {
			out.push(hb);
		}
	}
	return out;
}

function markModelItemInteracted(itemId) {
	if (!interactionModel || !interactionModel.itemsById.has(itemId)) {
		return;
	}
	interactionModel.itemsById.get(itemId).flags.hasBeenInteracted = true;
}

function applyHitboxDeclarativeRules(g) {
	if (!g || !interactionModel || !g.modelHitboxId) {
		return false;
	}
	const hb = interactionModel.hitboxesById.get(g.modelHitboxId);
	if (!hb) {
		return false;
	}
	for (let i = 0; i < hb.requireFlagsTrue.length; i++) {
		const f = hb.requireFlagsTrue[i];
		if (!globalThis[f]) {
			if (hb.onRequirementFail === "resetOrigin") {
				untoss(g);
			}
			return false;
		}
	}
	if (hb.clearScalpelInUse) {
		scalpelInUse = false;
	}
	for (let i = 0; i < hb.revealHitboxIds.length; i++) {
		const revealId = hb.revealHitboxIds[i];
		const revealHb = interactionModel.hitboxesById.get(revealId);
		if (!revealHb) {
			continue;
		}
		const revealG = grabbables[revealHb.grabbableIndex];
		if (revealG) {
			revealG.isConsumed = false;
			revealG.active = true;
			revealG.minPinchGeneration = globalPinchGeneration + 1;
			revealG.hasBeenGrabbed = false;
			untoss(revealG);
			revealG.visible = !revealHb.revealHidden;
		}
	}
	for (let i = 0; i < hb.hideHitboxIds.length; i++) {
		const hideId = hb.hideHitboxIds[i];
		const hideHb = interactionModel.hitboxesById.get(hideId);
		if (!hideHb) {
			continue;
		}
		const hideG = grabbables[hideHb.grabbableIndex];
		if (hideG) {
			hideG.visible = false;
			hideG.active = false;
			// Hidden is not consumed: tools may be reset/reopened later.
			hideG.isConsumed = false;
			toss(hideG);
		}
	}
	if (hb.consumeOnInteract) {
		g.isConsumed = true;
		g.active = false;
		toss(g);
	}
	return hb.consumeOnInteract ||
		hb.clearScalpelInUse ||
		hb.revealHitboxIds.length > 0 ||
		hb.hideHitboxIds.length > 0;
}

function handleBody1ItemFirstGrab(g) {
	if (!g || !g.modelItemId) {
		return false;
	}
	if (g.modelItemId === "b1_flap") {
		markModelItemInteracted("b1_flap");
		return true;
	}
	if (g.modelItemId === "b1_arm") {
		markModelItemInteracted("b1_arm");
		return true;
	}
	if (g.modelItemId === "b1_leg") {
		const itemHitboxes = getModelHitboxesForItem("b1_leg");
		for (let i = 0; i < itemHitboxes.length; i++) {
			const hb = itemHitboxes[i];
			if (hb.id === g.modelHitboxId) {
				continue;
			}
			const sibling = grabbables[hb.grabbableIndex];
			if (sibling) {
				toss(sibling);
			}
		}
		markModelItemInteracted("b1_leg");
		return true;
	}
	if (g.modelItemId === "b1_eye" && g.modelHitboxId === "b1_eye_lid") {
		applyHitboxDeclarativeRules(g);
		markModelItemInteracted("b1_eye");
		return true;
	}
	if (g.modelItemId === "b1_eye" && g.modelHitboxId === "b1_eye_ball") {
		markModelItemInteracted("b1_eye");
		return true;
	}
	return false;
}

function handleBody2ItemFirstGrab(g) {
	if (!g || !g.modelItemId || !g.modelItemId.startsWith("b2_")) {
		return false;
	}
	const applied = applyHitboxDeclarativeRules(g);
	if (!applied) {
		const hb = interactionModel?.hitboxesById?.get(g.modelHitboxId);
		if (hb && hb.requireFlagsTrue && hb.requireFlagsTrue.length > 0) {
			// Requirement-gated hitboxes (e.g. skin needs scalpel) must remain retryable.
			g.hasBeenGrabbed = false;
			g.isGrabbed = false;
			return true;
		}
	}
	markModelItemInteracted(g.modelItemId);
	return true;
}

function handleBody3ItemFirstGrab(g) {
	if (!g || !g.modelItemId || !g.modelItemId.startsWith("b3_")) {
		return false;
	}
	const applied = applyHitboxDeclarativeRules(g);
	if (!applied) {
		const hb = interactionModel?.hitboxesById?.get(g.modelHitboxId);
		if (hb && hb.requireFlagsTrue && hb.requireFlagsTrue.length > 0) {
			// Requirement-gated hitboxes must remain retryable.
			g.hasBeenGrabbed = false;
			g.isGrabbed = false;
			return true;
		}
	}
	markModelItemInteracted(g.modelItemId);
	return true;
}

function isToolItem(itemID) {
	return itemID === "tool_scalpel" || itemID === "tool_bonesaw" || itemID === "tool_hammer";
}

function getToolGrabbable(toolItemId) {
	for (let i = 0; i < grabbables.length; i++) {
		const g = grabbables[i];
		if (g && g.modelItemId === toolItemId) return g;
	}
	return null;
}

function getToolAngleForSide(side) {
	return side === "left" ? TOOL_LEFT_ANGLE : TOOL_RIGHT_ANGLE;
}

function getHeldToolTipPoint(toolObj, handSide) {
	if (!toolObj || !toolObj.pic || !toolObj.visible) {
		return null;
	}
	// Match render transform order: rotate(currentRotation) then local mirror for left tool.
	// Compute local forward axis first, mirror locally if left, then rotate to world.
	const rotDeg = toolObj.currentRotation;
	const len = toolObj.s * 1.5;
	let localX = cos(TOOL_TIP_AXIS_OFFSET_DEG);
	const localY = sin(TOOL_TIP_AXIS_OFFSET_DEG);
	if (handSide === "left") {
		localX *= -1;
	}
	const dirX = localX * cos(rotDeg) - localY * sin(rotDeg);
	const dirY = localX * sin(rotDeg) + localY * cos(rotDeg);
	return createVector(
		toolObj.pt.x + dirX * len,
		toolObj.pt.y + dirY * len
	);
}

class tracker{
	constructor() {
		this.hands = [];
		this.seenThisFrame = [];
	}
	getPinchPt(i){
		return this.hands[i].pinchPt
	}
	beginFrame() {
		this.seenThisFrame = new Array(this.hands.length).fill(false);
	}
	upsertHand(hand){
		const side = inferHandSide(hand);
		const wrist = mapTrackedPoint(hand.keypoints[ML5HAND_WRIST].x, hand.keypoints[ML5HAND_WRIST].y);
		let bestIdx = -1;
		let bestDist = Infinity;
		for (let i = 0; i < this.hands.length; i++) {
			if (this.hands[i].handSide !== side) {
				continue;
			}
			const d = vdist(this.hands[i].av, wrist);
			if (d < bestDist) {
				bestDist = d;
				bestIdx = i;
			}
		}

		if (bestIdx >= 0 && bestDist < 260) {
			this.hands[bestIdx].updateFromDetection(hand);
			this.seenThisFrame[bestIdx] = true;
			return;
		}
		if (bestIdx >= 0) {
			this.hands[bestIdx].updateFromDetection(hand);
			this.seenThisFrame[bestIdx] = true;
			return;
		}

		if (this.hands.length < HAND_MAX) {
			const hTrack = new oneHand(hand, this.hands.length);
			this.hands.push(hTrack);
			this.seenThisFrame.push(true);
			return;
		}

		let oldestIdx = -1;
		let maxMiss = -1;
		for (let i = 0; i < this.hands.length; i++) {
			if (this.hands[i].handSide !== side) {
				continue;
			}
			if (this.hands[i].missedFrames > maxMiss) {
				maxMiss = this.hands[i].missedFrames;
				oldestIdx = i;
			}
		}
		if (oldestIdx < 0) {
			oldestIdx = 0;
		}
		this.hands[oldestIdx] = new oneHand(hand, oldestIdx);
		this.seenThisFrame[oldestIdx] = true;
	}
	endFrame() {
		for (let i = this.hands.length - 1; i >= 0; i--) {
			if (!this.seenThisFrame[i]) {
				this.hands[i].stepNoDetection();
			}
		}
	}
	ud() {
		for (let i=0; i<this.hands.length; i++){
			this.hands[i].ud()
		}
	}
	display() {
		strokeWeight(10)
		for (let i = 0; i < this.hands.length; i++) {
			let hand = this.hands[i];
			for (let j = 0; j < hand.hand.keypoints.length; j++) {
				let keypoint = hand.hand.keypoints[j];
				fill(0,255,0);
				noStroke();
				circle(keypoint.x*wratio, keypoint.y*hratio, 10);
				// if (j==ML5HAND_THUMB_TIP)
			}	
		}
	}
}

class oneHand {
	constructor(hand, num){
		this.hand = hand
		this.handSide = inferHandSide(hand);
		this.av = createVector(0, 0);
		this.num = num;
		this.offscreenPt = getOffscreenPinch(this.handSide);
		this.homePt = getHomePinch(this.handSide);
		this.thumbTip = this.offscreenPt.copy();
		this.indexTip = this.offscreenPt.copy();
		this.pinchPt = this.offscreenPt.copy();
		this.trackedPinchPt = this.offscreenPt.copy();
		this.prevPinchPt = this.offscreenPt.copy();
		this.prevTrackedPinchPt = this.offscreenPt.copy();
		this.velocity = createVector(0, 0);
		this.lastLiveVelocity = createVector(0, 0);
		this.lostStartVelocity = createVector(0, 0);
		this.clawSpeed = 0;
		this.velocityHistory = [];
		this.pinching = false;
		this.pinchHold = 0;
		this.grabbed = null;
		this.currentPinchGeneration = 0;
		this.mustOpenBeforeNextInteraction = false;
		this.zigProgress = 0;
		this.missedFrames = 0;
		this.latestGrabbed = null;
		this.retreatStartPt = this.offscreenPt.copy();
		this.lastDetectionMs = millis();
		this.reconnectGrabCooldown = 0;
		this.isPickupAnimating = false;
		this.pickupTargetObj = null;
		this.pickupStage = 0;
		this.clawScale = 1;
		this.grabReach = 0;
		this.debugToolTip = null;
		this.debugToolHits = [];
		this.prevToolTip = null;
		this.toolTipSpeed = 0;
		this.cutGestureByHitboxId = new Map();
		this.lastHeldToolItemId = null;
		this.updateFromDetection(hand);
	}
	
	getAv(){
		let sumx = 0
		let sumy = 0
		let len = this.hand.keypoints.length
    for (let j = 0; j < len; j++) {
      let keypoint = this.hand.keypoints[j];
      const kp = mapTrackedPoint(keypoint.x, keypoint.y);
      sumx += kp.x
			sumy += kp.y
  	}
		this.av = createVector(sumx/len,sumy/len)
	}
	getClawControlPt() {
		// Single source of truth for where a grabbed object should follow.
		return this.pinchPt;
	}
	startPickupAnimation(targetObj) {
		this.isPickupAnimating = true;
		this.pickupTargetObj = targetObj;
		this.pickupStage = 1;
	}
	updatePickupAnimation() {
		if (!this.isPickupAnimating || !this.pickupTargetObj) {
			return false;
		}
		if (this.pickupStage === 1) {
			// Move claw toward object first; ignore live tracking in this phase.
			this.clawScale = lerp(this.clawScale, CLAW_PICKUP_SHRINK_SCALE, CLAW_SCALE_LERP);
			this.pinchPt = p5.Vector.lerp(this.pinchPt, this.pickupTargetObj.pt, PICKUP_TO_OBJECT_LERP);
			if (vdist(this.pinchPt, this.pickupTargetObj.pt) <= scaleDistanceForWindow(PICKUP_ATTACH_DIST)) {
				this.grabbed = this.pickupTargetObj;
				this.latestGrabbed = this.pickupTargetObj;
				this.pickupStage = 2;
			}
		}
		if (this.pickupStage === 2) {
			// After attach, interpolate claw back to tracked position.
			this.clawScale = lerp(this.clawScale, 1, CLAW_SCALE_LERP);
			this.pinchPt = p5.Vector.lerp(this.pinchPt, this.trackedPinchPt, PICKUP_RETURN_LERP);
			if (this.grabbed != null) {
				this.grabbed.ud(this.getClawControlPt(), this.handSide);
			}
			if (vdist(this.pinchPt, this.trackedPinchPt) <= scaleDistanceForWindow(PICKUP_RETURN_DIST)) {
				this.isPickupAnimating = false;
				this.pickupTargetObj = null;
				this.pickupStage = 0;
			}
		}
		return true;
	}
	releaseGrab(resetLatestGrabbed = false, allowThrow = false, forceUnpinch = true) {
		if (this.grabbed != null) {
			if (allowThrow && this.grabbed.pic != null) {
				let avgTrackedSpeed = 0;
				let sampledSpeed = 0;
				let avgTrackedDir = createVector(0, 0);
				if (this.velocityHistory.length > 0) {
					const oldestCount = min(THROW_TIER_OLDEST_SAMPLE_COUNT, this.velocityHistory.length);
					for (let i = 0; i < oldestCount; i++) {
						avgTrackedSpeed += this.velocityHistory[i].speed;
						avgTrackedDir.add(this.velocityHistory[i].v);
					}
					avgTrackedSpeed /= oldestCount;
					avgTrackedDir.div(oldestCount);
					sampledSpeed = avgTrackedSpeed;
				} else {
					sampledSpeed = this.clawSpeed;
				}
				const dir = this.velocityHistory.length > 0 ? avgTrackedDir.copy() : this.velocity.copy();
				const motionMag = dir.mag();
				if (motionMag > 0.0001) {
					dir.normalize();
					if (sampledSpeed >= scaleSpeedForWindow(THROW_BIG_THRESHOLD)) {
						this.grabbed.startThrow(p5.Vector.mult(dir, scaleSpeedForWindow(THROW_BIG_SPEED)));
					} else if (sampledSpeed >= scaleSpeedForWindow(THROW_SMALL_THRESHOLD)) {
						this.grabbed.startThrow(p5.Vector.mult(dir, scaleSpeedForWindow(THROW_SMALL_SPEED)));
					}
				}
			}
			this.grabbed.isGrabbed = false;
			this.grabbed = null;
		}
		if (forceUnpinch) {
			this.pinching = false;
			this.pinchHold = 0;
		}
		// One interaction per pinch: even soft-release needs open->close before next interaction.
		this.mustOpenBeforeNextInteraction = true;
		this.isPickupAnimating = false;
		this.pickupTargetObj = null;
		this.pickupStage = 0;
		if (resetLatestGrabbed) {
			this.latestGrabbed = null;
		}
	}
	updateFromDetection(hand) {
		const wasMissing = this.missedFrames > 0;
		this.hand = hand;
		this.missedFrames = 0;
		this.lastDetectionMs = millis();
		this.handSide = inferHandSide(hand);
		this.homePt = getHomePinch(this.handSide);
		this.offscreenPt = getOffscreenPinch(this.handSide);
		this.retreatStartPt = this.pinchPt.copy();
		const targetThumb = mapTrackedPoint(hand.keypoints[ML5HAND_THUMB_TIP].x, hand.keypoints[ML5HAND_THUMB_TIP].y);
		const targetIndex = mapTrackedPoint(hand.keypoints[ML5HAND_INDEX_FINGER_TIP].x, hand.keypoints[ML5HAND_INDEX_FINGER_TIP].y);
		const rawPinch = mid(targetThumb, targetIndex);
		const targetPinch = rawPinch.copy();
		const prevPinch = this.pinchPt.copy();
		const delta = p5.Vector.sub(targetPinch, prevPinch);
		const deltaMag = delta.mag();
		if (deltaMag > MAX_TRACK_JUMP) {
			delta.setMag(MAX_TRACK_JUMP);
			targetPinch.set(prevPinch.x + delta.x, prevPinch.y + delta.y);
			const shift = p5.Vector.sub(targetPinch, rawPinch);
			targetThumb.add(shift);
			targetIndex.add(shift);
		}

		this.thumbTip = p5.Vector.lerp(this.thumbTip, targetThumb, HAND_SMOOTH_ALPHA);
		this.indexTip = p5.Vector.lerp(this.indexTip, targetIndex, HAND_SMOOTH_ALPHA);
		const trackedVel = p5.Vector.sub(targetPinch, this.prevTrackedPinchPt);
		this.prevTrackedPinchPt = targetPinch.copy();
		this.trackedPinchPt = p5.Vector.lerp(this.trackedPinchPt, targetPinch, HAND_SMOOTH_ALPHA);
		if (!this.isPickupAnimating) {
			this.pinchPt = this.trackedPinchPt.copy();
		}
		this.velocity = p5.Vector.lerp(this.velocity, p5.Vector.sub(this.pinchPt, prevPinch), 0.5);
		this.lastLiveVelocity = this.velocity.copy();
		this.clawSpeed = p5.Vector.dist(this.pinchPt, prevPinch);
		this.velocityHistory.push({ v: trackedVel.copy(), speed: trackedVel.mag() });
		if (this.velocityHistory.length > THROW_VELOCITY_HISTORY_SIZE) {
			this.velocityHistory.shift();
		}
		this.prevPinchPt = prevPinch;

		this.getAv();
		const wrist = mapTrackedPoint(hand.keypoints[ML5HAND_WRIST].x, hand.keypoints[ML5HAND_WRIST].y);
		this.av = p5.Vector.lerp(this.av, wrist, 0.3);
		if (wasMissing) {
			this.releaseGrab(true);
			this.reconnectGrabCooldown = RECONNECT_GRAB_COOLDOWN_FRAMES;
		}
	}
	stepNoDetection() {
		this.missedFrames++;
		this.releaseGrab(true);
		this.velocity.mult(0.7);
		if (this.missedFrames === 1) {
			this.retreatStartPt = this.pinchPt.copy();
			this.lostStartVelocity = this.lastLiveVelocity.copy();
		}
		if (this.offscreenPt && this.retreatStartPt) {
			const prevPt = this.pinchPt.copy();
			const tRaw = constrain(this.missedFrames / OFFSCREEN_RETREAT_FRAMES, 0, 1);
			const xEase = pow(tRaw, 1.35);
			const yEase = pow(tRaw, 1.2);

			const baseX = lerp(this.retreatStartPt.x, this.offscreenPt.x, xEase);
			const baseY = lerp(this.retreatStartPt.y, this.offscreenPt.y, yEase);
			const bow = OFFSCREEN_ARC_BOW * sin(PI * tRaw);
			const arcDir = this.handSide === "left" ? -1 : 1;
			const offscreenTarget = createVector(baseX, baseY - (bow * arcDir * 0.35));
			const momentumScale = (tRaw * OFFSCREEN_RETREAT_FRAMES) * (1 - 0.35 * tRaw);
			const momentumPt = p5.Vector.add(this.retreatStartPt, p5.Vector.mult(this.lostStartVelocity, momentumScale));
			const blendToTarget = pow(tRaw, 1.25);
			const blendedPt = p5.Vector.lerp(momentumPt, offscreenTarget, blendToTarget);

			this.pinchPt.x = blendedPt.x;
			this.pinchPt.y = blendedPt.y;
			this.clawSpeed = p5.Vector.dist(this.pinchPt, prevPt);
		}
		this.thumbTip = p5.Vector.lerp(this.thumbTip, this.pinchPt, 0.3);
		this.indexTip = p5.Vector.lerp(this.indexTip, this.pinchPt, 0.3);
		if (this.missedFrames > MAX_MISSED_FRAMES) {
			this.pinching = false;
			this.pinchHold = 0;
		}
	}
	ud(){
		if (!this.hand) {
			return;
		}
		if (millis() - this.lastDetectionMs > HAND_STALE_MS) {
			this.stepNoDetection();
			return;
		}
		if (this.missedFrames > 0) {
			return;
		}
		if (this.pinchPt.x < 0 || this.pinchPt.x > w || this.pinchPt.y < 0 || this.pinchPt.y > h) {
			this.releaseGrab(false);
			return;
		}
		const wrist = this.hand.keypoints[ML5HAND_WRIST];
		const middleMcp = this.hand.keypoints[ML5HAND_MIDDLE_FINGER_MCP];
		const wristPt = mapTrackedPoint(wrist.x, wrist.y);
		const middleMcpPt = mapTrackedPoint(middleMcp.x, middleMcp.y);
		const palmScale = max(18, dist(wristPt.x, wristPt.y, middleMcpPt.x, middleMcpPt.y));
		const pinchDistance = vdist(this.thumbTip, this.indexTip);
		const pinchRatio = pinchDistance / palmScale;
		const wasPinching = this.pinching;
		if (pinchRatio > PINCH_OPEN_RATIO) {
			this.mustOpenBeforeNextInteraction = false;
		}
		s = palmScale * 0.8;
		this.grabReach = s;
		if (zigmode) this.checkzig()

		if (!this.pinching && !this.mustOpenBeforeNextInteraction && pinchRatio < PINCH_CLOSE_RATIO) {
			this.pinchHold++;
			if (this.pinchHold >= PINCH_HOLD_FRAMES) {
				this.pinching = true;
				this.pinchHold = PINCH_HOLD_FRAMES;
			}
		} else if (this.pinching && pinchRatio > PINCH_OPEN_RATIO) {
			this.releaseGrab(false, true, true);
		} else {
			this.pinchHold = max(0, this.pinchHold - 1);
		}
		if (this.reconnectGrabCooldown > 0) {
			this.reconnectGrabCooldown--;
		}
		if (!this.isPickupAnimating) {
			this.clawScale = lerp(this.clawScale, 1, CLAW_SCALE_LERP);
		}
		const justPinched = (!wasPinching && this.pinching);
		if (justPinched) {
			globalPinchGeneration++;
			this.currentPinchGeneration = globalPinchGeneration;
		}

		if (this.reconnectGrabCooldown <= 0 && justPinched && this.grabbed == null && !this.isPickupAnimating){
            let currClosestD = w;
            let currClosest = null;
            for (let i=0; i<grabbables.length; i++){
                let g = grabbables[i]
				if (!g.active) {
					continue;
				}
				const hb = (interactionModel && g.modelHitboxId) ? interactionModel.hitboxesById.get(g.modelHitboxId) : null;
				if (hb && hb.mode && hb.mode !== "grab") {
					continue;
				}
				if (g.minPinchGeneration > this.currentPinchGeneration) {
					continue;
				}
                let d = vdist(this.pinchPt,g.pt)
                if (d<((this.grabReach+g.s) * GRAB_RANGE_SCALE / getWindowScaleFactor()) && d<=currClosestD){
                    currClosestD = d
                    currClosest = g
                }
            }
            if (currClosest != null) {
                this.startPickupAnimation(currClosest);
            }
        }

		if (this.updatePickupAnimation()) {
			return;
		}
		this.updateToolGestureInteractions();

		if (this.grabbed != null && !this.grabbed.active) {
			// Consumed placeholders should release immediately.
			this.releaseGrab(false, false, false);
			return;
		}

		if (this.pinching && this.grabbed != null){
			this.grabbed.ud(this.getClawControlPt(), this.handSide);
		}
		this.updateDebugToolInteraction();
}
	updateDebugToolInteraction() {
		this.debugToolTip = null;
		this.debugToolHits = [];
		if (!this.grabbed || !isToolItem(this.grabbed.itemID)) {
			return;
		}
		const tip = getHeldToolTipPoint(this.grabbed, this.handSide);
		this.debugToolTip = tip;
		if (!tip) {
			return;
		}
		for (let i = 0; i < grabbables.length; i++) {
			const g = grabbables[i];
			if (!g || g === this.grabbed || !g.active) {
				continue;
			}
			const interactionRadius = g.s * TOOL_INTERACTION_RADIUS_FACTOR;
			if (vdist(tip, g.pt) <= interactionRadius) {
				this.debugToolHits.push(g);
			}
		}
	}
	updateToolGestureInteractions() {
		const heldTool = this.grabbed;
		if (!heldTool || !isToolItem(heldTool.itemID) || !this.pinching) {
			this.lastHeldToolItemId = null;
			this.prevToolTip = null;
			this.toolTipSpeed = 0;
			return;
		}
		const tip = getHeldToolTipPoint(heldTool, this.handSide);
		if (!tip) {
			this.prevToolTip = null;
			this.toolTipSpeed = 0;
			return;
		}
		this.toolTipSpeed = this.prevToolTip ? p5.Vector.dist(tip, this.prevToolTip) : 0;
		this.prevToolTip = tip.copy();
		const toolItemId = heldTool.modelItemId || null;
		const justPickedUpTool = this.lastHeldToolItemId !== toolItemId;
		this.lastHeldToolItemId = toolItemId;
		if (justPickedUpTool && typeof DEBUG_MODE !== "undefined" && DEBUG_MODE) {
			print("[TOOL_PICKED_UP]", {
				toolItemId: toolItemId,
				pinching: this.pinching
			});
		}
		for (const [hbId, hb] of interactionModel.hitboxesById.entries()) {
			const zoneG = grabbables[hb.grabbableIndex];
			if (!zoneG || !zoneG.active || zoneG.isConsumed) {
				continue;
			}
			let state = this.cutGestureByHitboxId.get(hbId);
			if (!state) {
				state = { armed: false, peak: 0, cooldown: 0, debugArmed: false, debugPeak: 0, highSpeedFrames: 0, debugHighSpeedFrames: 0 };
				this.cutGestureByHitboxId.set(hbId, state);
			}
			if (state.cooldown > 0) {
				state.cooldown--;
				continue;
			}
			const inZone = vdist(tip, zoneG.pt) <= (zoneG.s * TOOL_INTERACTION_RADIUS_FACTOR);
			if (!inZone) {
				state.armed = false;
				state.peak = 0;
				state.highSpeedFrames = 0;
				state.debugArmed = false;
				state.debugPeak = 0;
				state.debugHighSpeedFrames = 0;
				continue;
			}
			if (justPickedUpTool && typeof DEBUG_MODE !== "undefined" && DEBUG_MODE) {
				print("[TOOL_PICKUP_CONTACT]", {
					toolItemId: toolItemId,
					targetHitboxId: hbId,
					targetItemId: zoneG.modelItemId,
					interactionMode: hb.interactionMode || "grab",
					tipSpeed: this.toolTipSpeed
				});
			}
			let requiredSustainFrames = CUT_SUSTAIN_FRAMES_SCALPEL;
			if (toolItemId === "tool_bonesaw") {
				requiredSustainFrames = CUT_SUSTAIN_FRAMES_BONESAW;
			} else if (toolItemId === "tool_hammer") {
				requiredSustainFrames = CUT_SUSTAIN_FRAMES_HAMMER;
			}
			const scalpelMin = scaleSpeedForWindow(CUT_SCALPEL_MIN_SPEED);
			const scalpelMax = scaleSpeedForWindow(CUT_SCALPEL_MAX_SPEED);
			const bonesawMin = scaleSpeedForWindow(CUT_BONESAW_MIN_SPEED);
			const hammerMin = scaleSpeedForWindow(CUT_HAMMER_MIN_SPEED);
			let speedMatch = false;
			if (toolItemId === "tool_scalpel") {
				speedMatch = this.toolTipSpeed >= scalpelMin && this.toolTipSpeed <= scalpelMax;
			} else if (toolItemId === "tool_bonesaw") {
				speedMatch = this.toolTipSpeed > bonesawMin;
			} else if (toolItemId === "tool_hammer") {
				speedMatch = this.toolTipSpeed > hammerMin;
			}
			if (speedMatch) {
				state.debugHighSpeedFrames++;
			} else {
				state.debugHighSpeedFrames = 0;
			}
			if (state.debugHighSpeedFrames >= requiredSustainFrames) {
				if (typeof DEBUG_MODE !== "undefined" && DEBUG_MODE) {
					print("[TOOL_ACTION_TRIGGER_TEST]", {
						toolItemId: toolItemId,
						targetHitboxId: hbId,
						targetItemId: zoneG.modelItemId,
						interactionMode: hb.interactionMode || "grab",
						tipSpeed: this.toolTipSpeed
					});
				}
				state.debugHighSpeedFrames = 0;
			}
			if (hb.interactionMode !== "cut_gesture") {
				continue;
			}
			if (speedMatch) {
				state.highSpeedFrames++;
			} else {
				state.highSpeedFrames = 0;
			}
			if (state.highSpeedFrames >= requiredSustainFrames) {
				if (typeof DEBUG_MODE !== "undefined" && DEBUG_MODE) {
					print("[TOOL_ACTION_TRIGGER]", {
						toolItemId: toolItemId,
						targetHitboxId: hbId,
						targetItemId: zoneG.modelItemId,
						tipSpeed: this.toolTipSpeed
					});
				}
				applyHitboxDeclarativeRules(zoneG);
				zoneG.hasBeenGrabbed = true;
				markModelItemInteracted(zoneG.modelItemId);
				state.highSpeedFrames = 0;
				state.cooldown = hb.cutCooldownFrames || CUT_COOLDOWN_FRAMES;
			}
		}
	}
	checkzig() {
		if (zigProgress == zig.length){
			print("ZIGGED");
			zigProgress = 0;
			return
		}
		if (vdist(this.indexTip,zstart)<100){
			zigProgress = 1;
			print("reset")
			// circle(this.indexTip.x,this.indexTip.y,70)
			return
		}
		else {
			let next = zig[zigProgress]
			// print(zigProgress)
			if (vdist(this.indexTip,vadd(next,zstart))<100){
				// circle(this.indexTip.x,this.indexTip.y,50)
				zigProgress ++;
			}
		}
		
	}
	
	// pinch(p){
	// 	this.pinchPt = mid(indexTip,thumbTip)
	// }	
}

class grabbable {
	constructor(x,y,s,v, ID, pic) {
		this.pt = createVector(x,y)
		this.s = s
		this.grabbed = false
		this.color = color(s*2,s*2,255)
		this.visible = v;
		this.isGrabbed = false;
		this.hasBeenGrabbed = false;
		this.itemID = ID;
		this.pic = pic;
		this.origX = x;
		this.origY = y;
		this.movable = true;
		this.active = true;
		this.grabbedByHandSide = "right";
		this.baseScale = 1;
		this.currentScale = 1;
		this.grabScale = 1.1;
		this.currentRotation = 0;
		this.grabRotation = random(-10, 10);
		this.dropSpinVelocity = 0;
		this.wasGrabbedLastFrame = false;
		this.bounceFramesLeft = 0;
		this.bounceSpinPerFrame = 0;
		this.pendingDropSpin = 0;
		this.pickupOrder = -1;
		this.minPinchGeneration = 0;
		this.isThrown = false;
		this.throwVelocity = createVector(0, 0); // Linear trajectory only (position).
		this.throwAngularVelocity = 0;
		this.throwStartSpeed = 0;
		this.throwStartScale = 1;
		this.throwPeakScale = 1.35;
		this.endBounceVelocity = createVector(0, 0);
		this.endBounceAngularVelocity = 0;
	}
	startThrow(v) {
		this.isThrown = true;
		this.throwVelocity = v.copy(); // Position trajectory source.
		this.throwStartSpeed = max(0.001, this.throwVelocity.mag());
		this.throwStartScale = this.currentScale;
		this.throwPeakScale = max(this.throwStartScale, 2);
		const spinSign = (abs(this.throwVelocity.x) >= abs(this.throwVelocity.y))
			? (this.throwVelocity.x >= 0 ? 1 : -1)
			: (this.throwVelocity.y >= 0 ? 1 : -1);
		this.throwAngularVelocity = spinSign * constrain(this.throwStartSpeed * 0.35, 16, 40);
		this.dropSpinVelocity = 0;
		this.pendingDropSpin = 0;
		this.bounceFramesLeft = 0;
		this.endBounceVelocity.set(0, 0);
		this.endBounceAngularVelocity = 0;
	}
	updateThrowMotion() {
		if (!this.isThrown) {
			return;
		}
		// Position trajectory is strictly linear-velocity based.
		this.pt.x += this.throwVelocity.x;
		this.pt.y += this.throwVelocity.y;
		if (this.pt.x < 0) {
			this.pt.x = 0;
			this.throwVelocity.x = 0;
		}
		if (this.pt.x > w) {
			this.pt.x = w;
			this.throwVelocity.x = 0;
		}
		if (this.pt.y < 0) {
			this.pt.y = 0;
			this.throwVelocity.y = 0;
		}
		if (this.pt.y > h) {
			this.pt.y = h;
			this.throwVelocity.y = 0;
		}
		// Rotation is strictly angular-velocity based and does not feed back into position.
		this.currentRotation += this.throwAngularVelocity;
		this.throwVelocity.mult(THROW_DECEL);
		this.throwAngularVelocity *= THROW_SPIN_DAMP;
		const speedNow = this.throwVelocity.mag();
		const throwProgress = 1 - constrain(speedNow / this.throwStartSpeed, 0, 1);
		let targetThrowScale;
		if (throwProgress < 0.5) {
			targetThrowScale = lerp(this.throwStartScale, this.throwPeakScale, throwProgress * 2);
		} else {
			targetThrowScale = lerp(this.throwPeakScale, this.baseScale, (throwProgress - 0.5) * 2);
		}
		this.currentScale = lerp(this.currentScale, targetThrowScale, 0.32);
		if (this.throwVelocity.mag() < 0.25 && abs(this.throwAngularVelocity) < 0.2) {
			const endDir = this.throwVelocity.mag() > 0.0001
				? this.throwVelocity.copy().normalize()
				: createVector(0, 0);
			this.endBounceVelocity = p5.Vector.mult(endDir, -2.2);
			this.endBounceAngularVelocity = -Math.sign(this.throwAngularVelocity || 1) * 2.5;
			this.isThrown = false;
			this.throwVelocity.set(0, 0);
			this.throwAngularVelocity = 0;
		}
	}
	
	drop(){
		this.updateThrowMotion();
		if (this.endBounceVelocity.mag() > 0.01 || abs(this.endBounceAngularVelocity) > 0.01) {
			this.pt.add(this.endBounceVelocity);
			this.pt.x = constrain(this.pt.x, 0, w);
			this.pt.y = constrain(this.pt.y, 0, h);
			this.currentRotation += this.endBounceAngularVelocity;
			this.endBounceVelocity.mult(0.55);
			this.endBounceAngularVelocity *= 0.55;
		}
        // print("dropped")
        if (this.pt.x<400 && (200 < this.pt.y && this.pt.y < 500)){
						if (lithiumIsOpen)
						{toss(this)}
						if(this.itemID%2==0)
							{
								
							}
					else{
						
					}
            // let index = grabbables.indexOf(this);
            // grabbables.splice(index, 1);
        }
        if (this.pt.x<400 && (600 < this.pt.y && this.pt.y < 900)){
            if (alkalineIsOpen) {toss(this)}
						if(this.itemID%2==1)
							{
								 
							}
						else{
							
						}
        }
	}
ud(pt, handSide) {
		if (!this.active) {
			return;
		}
		if (!this.isGrabbed) {
			if (isToolItem(this.itemID)) {
				// Tools settle to handed hold orientation.
				this.grabRotation = getToolAngleForSide(handSide);
			} else {
				this.grabRotation = this.currentRotation + random(-10, 10);
			}
			this.pickupOrder = ++grabRenderCounter;
		}
		if (isToolItem(this.itemID)) {
			this.grabRotation = getToolAngleForSide(handSide);
		}
		this.isGrabbed = true;
		if (handSide) {
			this.grabbedByHandSide = handSide;
		}
		this.isThrown = false;
		this.throwVelocity.set(0, 0);
		this.throwAngularVelocity = 0;
		if (this.movable)
		{
			this.pt.x = constrain(pt.x, 0, w);
			this.pt.y = constrain(pt.y, 0, h);
		}
		this.visible=true;
		
		if (!this.hasBeenGrabbed)
			{
				let rand = random(4);
				if (rand>3)
					{
						rustle.play()
					}
				else if (rand>2) {
					rustleL.play()
				}
				else if (rand>1){
					pickup.play();
				}
				else {
					pickupL.play();
				}
				// print("update")
				this.hasBeenGrabbed = true;
				if (handleBody1ItemFirstGrab(this)) {
					return;
				}
				if (handleBody2ItemFirstGrab(this)) {
					return;
				}
				if (handleBody3ItemFirstGrab(this)) {
					return;
				}
				switch (this.modelItemId){
					case "tool_scalpel":
					scalpelInUse = true;
						this.hasBeenGrabbed=false;
						break;
					case "tool_bonesaw":
					bonesawInUse = true;
						this.hasBeenGrabbed=false;
						break;
						
					case "tool_hammer":
					hammerInUse = true;
						this.hasBeenGrabbed=false;
						break;
				}
				
					
			}
	}
	
	display() {
		if (!this.isThrown && !this.wasGrabbedLastFrame && this.isGrabbed) {
			// Pickup bounce: tiny opposite pre-rotation before settling toward grabRotation.
			const dir = this.grabRotation === 0 ? 1 : Math.sign(this.grabRotation);
			this.bounceFramesLeft = 2;
			this.bounceSpinPerFrame = -dir * 1.2;
		}
		if (!this.isThrown && this.wasGrabbedLastFrame && !this.isGrabbed) {
			// Drop bounce: brief opposite rotation, then release spin.
			this.pendingDropSpin = random(-4, 4);
			const dir = this.pendingDropSpin === 0 ? 1 : Math.sign(this.pendingDropSpin);
			this.bounceFramesLeft = 2;
			this.bounceSpinPerFrame = -dir * 1.4;
		}
		this.wasGrabbedLastFrame = this.isGrabbed;

		const targetScale = this.isGrabbed ? this.grabScale : this.baseScale;
		const targetRot = this.isGrabbed ? this.grabRotation : this.currentRotation;
		this.currentScale = lerp(this.currentScale, targetScale, 0.29);
		this.currentRotation = lerp(this.currentRotation, targetRot, 0.24);
		if (this.bounceFramesLeft > 0) {
			this.currentRotation += this.bounceSpinPerFrame;
			this.bounceFramesLeft--;
			if (this.bounceFramesLeft === 0 && this.pendingDropSpin !== 0) {
				this.dropSpinVelocity = this.pendingDropSpin;
				this.pendingDropSpin = 0;
			}
		}
		this.currentRotation += this.dropSpinVelocity;
		this.dropSpinVelocity *= 0.8;

		noStroke();
		fill(255, 255, 255, 50);
		//circle(this.pt.x,this.pt.y, this.s);
		
		if(this.visible && (this.pic != null))
			{
				// Position transform scope (trajectory only).
				push();
				translate(this.pt.x, this.pt.y);
				// Rotation/scale transform scope (visual only).
				push();
				rotate(this.currentRotation);
				scale(this.currentScale);
				if (isToolItem(this.itemID) && this.grabbedByHandSide === "left") {
					scale(-1, 1);
				}
				image(this.pic, 0, 0);
				pop();
				pop();
				//image(this.pic, wc, hc);
			}
	}
}


function toss(g)
{
	g.pt.x = GONE;
	g.pt.y = GONE;
	g.visible = false;
}

function untoss(g)
{
	g.pt.x = g.origX;
	g.pt.y = g.origY;
	//g.visible = true;
}

function preloadWeg() {
  // Load the handpose model.
	zig = [createVector(0,0),createVector(200,0),createVector(400,0),createVector(500,0),createVector(400,100),createVector(200,400),createVector(0,500),createVector(500,500)];
	zstart = createVector(w/5,h/5);
  handpose = ml5.handpose(options);
	bodyGrabbablesData = loadJSON("data/body-grabbables.json");
}

//SETUP

function setupWeg() {
	
	colorMode(RGB,255)
	if (!mainCanvas) {
		mainCanvas = createCanvas(w, h);
	}
	resizeCanvas(w, h);
  // Create the webcam video and hide it
  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();
  // start detecting hands from the webcam video
  handpose.detectStart(video, gotHands);
	// for (let i=0; i<10; i++){
	// 	grabbables.push(new grabbable(width/2, i*height/10,30+(5*i)))
	// }
	handTracker = (new tracker());
	resetInteractionModel();
	
	setupBody1();
	setupTools();
	
}

function drawWeg() {
	
  // Draw the webcam video
	//background(255);
	push();
	if (options.flipHorizontal){
		translate(width,0); 
		scale(-1,1);
	}
	let transparency = 100; // reduce this to make video transparent
	tint(255,255,255,transparency); 
  //image(video, 0, 0, width, height);
	pop();

	handTracker.ud();
	for (let i=0; i<grabbables.length; i++){
		grabbables[i].drop();
	}
	renderGrabbablesUnderClaws();
	drawHands();
	renderGrabbablesOverClaws();
	// updateHand();
	// handTracker.display();
	stroke(255,0,0)
	strokeWeight(10)
	// line(10,10,s,10)
	noFill();
	if (zigmode){
		circle(zstart.x,zstart.y,100);
		for (let i=0; i<zig.length-1; i++){
			line(zig[i].x+zstart.x,zig[i].y+zstart.y,zig[i+1].x+zstart.x,zig[i+1].y+zstart.y);
		}
	}
}

function drawDebugInteractableHitboxes() {
	if (typeof DEBUG_MODE === "undefined" || !DEBUG_MODE) {
		return;
	}
	const isOnScreen = (pt) => pt && pt.x >= 0 && pt.x <= w && pt.y >= 0 && pt.y <= h;
	const toolHotSet = new Set();
	for (let hIdx = 0; hIdx < handTracker.hands.length; hIdx++) {
		const handObj = handTracker.hands[hIdx];
		if (!handObj || !handObj.grabbed || !isToolItem(handObj.grabbed.itemID) || !handObj.debugToolTip) {
			continue;
		}
		for (let i = 0; i < grabbables.length; i++) {
			const g = grabbables[i];
			if (!g || !isOnScreen(g.pt)) {
				continue;
			}
			const interactionRadius = g.s * TOOL_INTERACTION_RADIUS_FACTOR;
			if (vdist(handObj.debugToolTip, g.pt) <= interactionRadius) {
				toolHotSet.add(i);
			}
		}
	}

	push();
	noFill();
	strokeWeight(2);

	// Grabbable hitboxes (all visible interactables on screen).
	for (let i = 0; i < grabbables.length; i++) {
		const g = grabbables[i];
		if (!g || !isOnScreen(g.pt)) {
			continue;
		}
		const toolInside = toolHotSet.has(i);
		const baseColor = g.hasBeenGrabbed ? color(0, 120, 255, 210) : color(255, 60, 60, 210);
		stroke(toolInside ? color(0, 255, 120, 230) : baseColor);
		circle(g.pt.x, g.pt.y, g.s * 2);
		stroke(toolInside ? color(255, 255, 0, 230) : color(255, 255, 255, 90));
		circle(g.pt.x, g.pt.y, g.s * TOOL_INTERACTION_RADIUS_FACTOR * 2);
	}

	// Drop-zone interactables.
	stroke(255, 220, 0, 190);
	rectMode(CORNERS);
	rect(0, 200, 400, 500);
	rect(0, 600, 400, 900);

	// Per-hand grab interaction radii (matches grab logic).
	for (let hIdx = 0; hIdx < handTracker.hands.length; hIdx++) {
		const handObj = handTracker.hands[hIdx];
		const p = handObj.pinchPt;
		const baseR = (handObj.grabReach * GRAB_RANGE_SCALE / getWindowScaleFactor());
		let anyInRange = false;
		for (let i = 0; i < grabbables.length; i++) {
			const g = grabbables[i];
			if (!g || !isOnScreen(g.pt) || !g.active) {
				continue;
			}
			const edgeToEdgeReach = baseR + (g.s * GRAB_RANGE_SCALE / getWindowScaleFactor());
			if (vdist(p, g.pt) <= edgeToEdgeReach) {
				anyInRange = true;
				break;
			}
		}
		stroke(anyInRange ? color(0, 255, 120, 220) : color(255, 255, 255, 120));
		circle(p.x, p.y, baseR * 2);
	}
	pop();
}

function renderGrabbablesUnderClaws() {
	const released = [];
	for (let i = 0; i < grabbables.length; i++) {
		if (!grabbables[i].isGrabbed) {
			released.push(grabbables[i]);
		}
	}
	released.sort((a, b) => a.pickupOrder - b.pickupOrder);
	for (let i = 0; i < released.length; i++) {
		released[i].display();
	}
}

function renderGrabbablesOverClaws() {
	const held = [];
	for (let i = 0; i < grabbables.length; i++) {
		if (grabbables[i].isGrabbed) {
			held.push(grabbables[i]);
		}
	}
	held.sort((a, b) => a.pickupOrder - b.pickupOrder);
	for (let i = 0; i < held.length; i++) {
		held[i].display();
	}
}

function drawHands(){
	for (let i=0; i<handTracker.hands.length; i++){
		let h = handTracker.hands[i]
		let p = h.pinchPt;
		const clawImg = h.pinching ? closedclaw : openclaw;
		if (!clawImg) {
			continue;
		}
		if (h.handSide === "left") {
			push();
			translate(p.x, p.y);
			scale(-1, 1);
			imageMode(CENTER);
			scale(h.clawScale, h.clawScale);
			image(clawImg, 0, 0);
			pop();
		} else {
			push();
			translate(p.x, p.y);
			imageMode(CENTER);
			scale(h.clawScale, h.clawScale);
			image(clawImg, 0, 0);
			pop();
		}

	}
	
}

function drawHandDebugOverlay() {
	if (typeof DEBUG_MODE === "undefined" || !DEBUG_MODE) {
		return;
	}
	for (let i = 0; i < handTracker.hands.length; i++) {
		const h = handTracker.hands[i];
		const p = h.pinchPt;
		push();
		noFill();
		stroke(255, 0, 255, 230);
		strokeWeight(2);
		circle(p.x, p.y, 14);
		pop();

		if (h.grabbed && isToolItem(h.grabbed.itemID)) {
			const explicitTip = getHeldToolTipPoint(h.grabbed, h.handSide);
			if (explicitTip) {
				push();
				stroke(255, 180, 0);
				strokeWeight(2);
				line(p.x, p.y, explicitTip.x, explicitTip.y);
				noFill();
				circle(p.x, p.y, 14);
				circle(explicitTip.x, explicitTip.y, 14);
				pop();
			}
		}

		if (h.debugToolTip) {
			const heldTool = h.grabbed;
			const toolLen = heldTool ? heldTool.s : 0;
			push();
			stroke(255, 180, 0);
			strokeWeight(2);
			line(p.x, p.y, h.debugToolTip.x, h.debugToolTip.y);
			noFill();
			circle(p.x, p.y, 14);
			circle(h.debugToolTip.x, h.debugToolTip.y, 14);
			circle(p.x, p.y, toolLen * 2);
			pop();

			for (let j = 0; j < h.debugToolHits.length; j++) {
				const g = h.debugToolHits[j];
				push();
				noFill();
				stroke(0, 255, 0);
				strokeWeight(3);
				circle(g.pt.x, g.pt.y, g.s * TOOL_INTERACTION_RADIUS_FACTOR * 2);
				pop();
			}
		}
	}
}

function drawAllDebugOverlays() {
	if (typeof DEBUG_MODE === "undefined" || !DEBUG_MODE) {
		return;
	}
	drawDebugInteractableHitboxes();
	drawHandDebugOverlay();
}



// Callback function for when handpose outputs data
function gotHands(results) {
  // save the output to the hands variable
  hands = results;

	handTracker.beginFrame();
	for (let i = 0; i < hands.length; i++) {
		handTracker.upsertHand(hands[i]);
	}
	handTracker.endFrame();
}

function getPicByKeyMap() {
	return {
		body1flap, body1arm_severed, body1leg_severed, body1eyeball_severed,
		scalpel, bonesaw, hammer,
		body2_hand_severed, body2_knee_severed, body2_heart_severed, body2flap,
		body3_guts_severed, body3_brain_severed, body3_foot_severed, body3flap
	};
}

function setupGrabbablesFromBodyDefs(bodyKey) {
	if (!bodyGrabbablesData || !bodyGrabbablesData[bodyKey]) {
		return;
	}
	const picByKey = getPicByKeyMap();
	const section = bodyGrabbablesData[bodyKey];
	const items = Array.isArray(section?.items) ? section.items : [];
	for (let i = 0; i < items.length; i++) {
		const itemDef = items[i];
		const hitboxes = Array.isArray(itemDef.hitboxes) ? itemDef.hitboxes : [];
		for (let j = 0; j < hitboxes.length; j++) {
			const hb = hitboxes[j];
			const id = itemDef.itemId || hb.itemId || hb.hitboxId || hb.idName;
			const isTool = isToolItem(id);
			const picKey = hb.picKey || itemDef.picKey;
			const pic = picKey ? picByKey[picKey] : null;
			const g = new grabbable(hb.x, hb.y, hb.radius, false, id, pic);
			const active = (typeof hb.active === "boolean") ? hb.active : (typeof itemDef.active === "boolean" ? itemDef.active : true);
			g.active = active;
			if (hb.movable === false || itemDef.movable === false) {
				g.movable = false;
			}
			if (isTool) {
				g.currentRotation = TOOL_RIGHT_ANGLE;
				g.grabRotation = TOOL_RIGHT_ANGLE;
			}
			grabbables.push(g);
			const grabbableIndex = grabbables.length - 1;
			registerModelHitbox(bodyKey, itemDef, hb, id, g, grabbableIndex);
			if (hb.toss || itemDef.toss) {
				toss(g);
			}
		}
	}
}

function setupBody1() { setupGrabbablesFromBodyDefs("body1"); }
function setupTools() { setupGrabbablesFromBodyDefs("tools"); }
function setupBody2() { setupGrabbablesFromBodyDefs("body2"); }
function setupBody3() { setupGrabbablesFromBodyDefs("body3"); }

function setBodyGrabbablesActive(bodyNum, isActive) {
	const bodyKey = bodyNum === 1 ? "body1" : (bodyNum === 2 ? "body2" : (bodyNum === 3 ? "body3" : null));
	if (!bodyKey || !interactionModel || !interactionModel.bodyHitboxIds.has(bodyKey)) {
		return;
	}
	const hitboxIds = interactionModel.bodyHitboxIds.get(bodyKey);
	for (let i = 0; i < hitboxIds.length; i++) {
		const hb = interactionModel.hitboxesById.get(hitboxIds[i]);
		if (!hb) {
			continue;
		}
		const g = grabbables[hb.grabbableIndex];
		if (g) {
			if (g.isConsumed) {
				g.active = false;
				continue;
			}
			if (!isActive && g.hasBeenGrabbed) {
				g.active = true;
			} else {
				g.active = isActive;
			}
		}
	}
}

function cleanupBodyUninteracted(bodyKey) {
	if (!interactionModel || !interactionModel.bodyItemIds.has(bodyKey)) {
		return;
	}
	const itemIds = interactionModel.bodyItemIds.get(bodyKey);
	for (let i = 0; i < itemIds.length; i++) {
		const itemId = itemIds[i];
		const hitboxes = getModelHitboxesForItem(itemId);
		let anyGrabbed = false;
		for (let j = 0; j < hitboxes.length; j++) {
			const g = grabbables[hitboxes[j].grabbableIndex];
			if (g && g.hasBeenGrabbed) {
				anyGrabbed = true;
				break;
			}
		}
		if (anyGrabbed) {
			continue;
		}
		for (let j = 0; j < hitboxes.length; j++) {
			const g = grabbables[hitboxes[j].grabbableIndex];
			if (g) {
				toss(g);
			}
		}
	}
}

function resetToolsToDrawer() {
	const toolItemIds = ["tool_scalpel", "tool_bonesaw", "tool_hammer"];
	for (let i = 0; i < toolItemIds.length; i++) {
		const g = getToolGrabbable(toolItemIds[i]);
		if (!g) {
			continue;
		}
		g.isGrabbed = false;
		g.active = false;
		g.visible = false;
		g.isConsumed = false;
		toss(g);
	}
	scalpelInUse = false;
	bonesawInUse = false;
	hammerInUse = false;
	if (handTracker && Array.isArray(handTracker.hands)) {
		for (let i = 0; i < handTracker.hands.length; i++) {
			const h = handTracker.hands[i];
			if (h && h.grabbed && isToolItem(h.grabbed.itemID)) {
				h.releaseGrab(false, false, false);
			}
		}
	}
}

function hasModelHitboxBeenGrabbed(hitboxId) {
	if (!interactionModel || !interactionModel.hitboxesById.has(hitboxId)) {
		return false;
	}
	const hb = interactionModel.hitboxesById.get(hitboxId);
	const g = grabbables[hb.grabbableIndex];
	return !!(g && g.hasBeenGrabbed);
}

function hasModelItemBeenInteracted(itemId) {
	const hitboxes = getModelHitboxesForItem(itemId);
	for (let i = 0; i < hitboxes.length; i++) {
		const g = grabbables[hitboxes[i].grabbableIndex];
		if (g && g.hasBeenGrabbed) {
			return true;
		}
	}
	return false;
}


const GONE = 9000;

// The following index labels may be helpful:
const ML5HAND_WRIST = 0; 
const ML5HAND_THUMB_CMC = 1; 
const ML5HAND_THUMB_MCP = 2; 
const ML5HAND_THUMB_IP = 3; 
const ML5HAND_THUMB_TIP = 4; 
const ML5HAND_INDEX_FINGER_MCP = 5; 
const ML5HAND_INDEX_FINGER_PIP = 6; 
const ML5HAND_INDEX_FINGER_DIP = 7; 
const ML5HAND_INDEX_FINGER_TIP = 8; 
const ML5HAND_MIDDLE_FINGER_MCP = 9; 
const ML5HAND_MIDDLE_FINGER_PIP = 10; 
const ML5HAND_MIDDLE_FINGER_DIP = 11; 
const ML5HAND_MIDDLE_FINGER_TIP = 12; 
const ML5HAND_RING_FINGER_MCP = 13; 
const ML5HAND_RING_FINGER_PIP = 14; 
const ML5HAND_RING_FINGER_DIP = 15; 
const ML5HAND_RING_FINGER_TIP = 16; 
const ML5HAND_PINKY_MCP = 17; 
const ML5HAND_PINKY_PIP = 18; 
const ML5HAND_PINKY_DIP = 19; 
const ML5HAND_PINKY_TIP = 20; 
