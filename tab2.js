



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
let options = { maxHands: 2, flipHorizontal: true };
let grabRenderCounter = 0;
let s = 15
let pinch = [false,false]
const TRACKING_OVERFLOW_SCALE_X = 1.25;
const TRACKING_OVERFLOW_SCALE_Y = 1.2;
const HAND_MAX = 2;
const PINCH_CLOSE_RATIO = 0.48;
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
				this.grabbed.ud(this.getClawControlPt());
			}
			if (vdist(this.pinchPt, this.trackedPinchPt) <= scaleDistanceForWindow(PICKUP_RETURN_DIST)) {
				this.isPickupAnimating = false;
				this.pickupTargetObj = null;
				this.pickupStage = 0;
			}
		}
		return true;
	}
	releaseGrab(resetLatestGrabbed = false, allowThrow = false) {
		if (this.grabbed != null) {
			if (allowThrow) {
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
		this.pinching = false;
		this.pinchHold = 0;
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
		s = palmScale * 0.8;
		if (zigmode) this.checkzig()

		if (!this.pinching && pinchRatio < PINCH_CLOSE_RATIO) {
			this.pinchHold++;
			if (this.pinchHold >= PINCH_HOLD_FRAMES) {
				this.pinching = true;
				this.pinchHold = PINCH_HOLD_FRAMES;
			}
		} else if (this.pinching && pinchRatio > PINCH_OPEN_RATIO) {
			this.releaseGrab(false, true);
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

		if (this.reconnectGrabCooldown <= 0 && justPinched && this.grabbed == null && !this.isPickupAnimating){
            let currClosestD = w;
            let currClosest = null;
            for (let i=0; i<grabbables.length; i++){
                let g = grabbables[i]
				if (!g.active) {
					continue;
				}
                let d = vdist(this.pinchPt,g.pt)
                if (d<((s+g.s) * GRAB_RANGE_SCALE / getWindowScaleFactor()) && d<=currClosestD){
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

		if (this.pinching && this.grabbed != null){
			this.grabbed.ud(this.getClawControlPt());
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
ud(pt) {
		if (!this.active) {
			return;
		}
		if (!this.isGrabbed) {
			this.grabRotation = this.currentRotation + random(-10, 10);
			this.pickupOrder = ++grabRenderCounter;
		}
		this.isGrabbed = true;
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
				print("update")
				this.hasBeenGrabbed = true;
				switch (this.itemID){
					case B1FLAP:
						body1hasFlap = false;
						break;
					case B1ARM:
						body1hasArm = false;
						break;
					case B1LEG1:
						body1hasLeg = false;
						toss(grabbables[B1LEG2]);
						break;
					case B1LEG2:
						body1hasLeg = false;
						toss(grabbables[B1LEG1]);
						break;
					case B1EYEBALL:
						body1hasEyelid = false;
						untoss(grabbables[B1EYEBALL2])
						grabbables[B1EYEBALL2].visible = true;
						//toss(grabbables[B1EYEBALL2]);
						break;
					case B1EYEBALL2:
						body1hasEyeball = false;
						break;
					//blob :3 — Today at 11:55 AM
					//TOOLS BREAK
					case B2HAND:
							body2hasHand = false;
							break;
					case B2KNEE:
							body2hasKnee = false;
							break;
					case B2HEART:
							body2hasHeart = false;
							break;
					case B2FLAP:
							body2hasFlap = false;
							untoss(grabbables[B2SKIN])
							break;
					case B2SKIN:
							if(!scalpelInUse)
							{
								untoss(this);
							}
						else {
								this.movable = true;
								toss(this);
								body2hasSkin = false;
								scalpelInUse = false;
								grabbables[SCALPELG].visible = false;
								untoss(grabbables[SCALPELG])
								untoss(grabbables[B2RIB])
							}
							break;
					case B2RIB:
							body2hasRibs = false;
							untoss(grabbables[B2HEART])
							break;
					case B3GUTS:
							body3hasGuts = false;
							break;
					case B3BRAIN:
							body3hasBrain = false;
							break;
					case B3FOOT:
							body3hasFoot = false;
							break;
					case B3FLAP:
							body3hasFlap = false;
							untoss(grabbables[B3SKIN])
							break;
					case B3SKIN:
							if(!scalpelInUse)
							{
								untoss(this);
							}
						else {
								this.movable = true;
								body3hasSkin = false;
								scalpelInUse = false;
								toss(this);
								grabbables[SCALPELG].visible = false;
								untoss(grabbables[SCALPELG])
								untoss(grabbables[B3GUTS])
							}
							break;
					case B3SKULL:
							body3hasSkull = false;
							untoss(grabbables[B3BRAIN])
							break;
						
					case SCALPELG:
					scalpelInUse = true;
					//toss(grabbables[SCALPELG]);
						this.hasBeenGrabbed=false;
						break;
					case BONESAWG:
					bonesawInUse = true;
					//toss(grabbables[BONESAWG]);
						this.hasBeenGrabbed=false;
						break;
						
					case HAMMERG:
					bonesawInUse = true;
					//toss(grabbables[HAMMERG]);
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
	
	setupBody1();
	
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
	// updateObj();
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



function updateObj(){
	for (let i = 0; i < hands.length; i++) {
		if (pinch[i] && vdist(pinchPt[i],obj)<s){
			// print("pinch on obj")
			pinched[i] = true
			
		}
		if (pinched[i]){
			obj.x = pinchPt[i].x
			obj.y = pinchPt[i].y
		}
	}
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

function setupBody1()
{
	B1flap = new grabbable(810, 472, B1flapRadius, false, B1FLAP, body1flap);
	grabbables.push(B1flap);
	B1flap.active = false;
	B1arm = new grabbable(995, 513, B1armRadius, false, B1ARM, body1arm_severed);
	grabbables.push(B1arm);
	B1arm.active = false;
	B1leg1 = new grabbable(728, 751, B1leg1Radius, false, B1LEG1, body1leg_severed);
	grabbables.push(B1leg1);
	B1leg1.active = false;
	B1leg2 = new grabbable(666, 874, B1leg2Radius, false, B1LEG2, body1leg_severed);
	grabbables.push(B1leg2);
	B1leg2.active = false;
	B1eyeball = new grabbable(700, 271, B1eyeballRadius, false, B1EYEBALL, null);
	grabbables.push(B1eyeball);
	B1eyeball.active = false;
	B1eyeball2 = new grabbable(700, 271, B1eyeball2Radius, false, B1EYEBALL2, body1eyeball_severed);
	grabbables.push(B1eyeball2);
	B1eyeball2.active = false;
	toss(B1eyeball2);
	scalpelG = new grabbable(scalpelX, scalpelY, scalpelRadius, false, SCALPELG, scalpel);
	grabbables.push(scalpelG);
	toss(scalpelG);
	bonesawG = new grabbable(bonesawX, bonesawY, bonesawRadius, false, BONESAWG, bonesaw);
	grabbables.push(bonesawG);
	toss(bonesawG);
	hammerG = new grabbable(hammerX, hammerY, hammerRadius, false, HAMMERG, hammer);
	grabbables.push(hammerG);
	toss(hammerG);
}

function setupBody2()
{
	B2hand = new grabbable(944, 632, B2handRadius, false, B2HAND, body2_hand_severed);
    grabbables.push(B2hand);
	B2hand.active = false;
	B2knee = new grabbable(653, 734, B2kneeRadius, false, B2KNEE, body2_knee_severed);
			grabbables.push(B2knee);
	B2knee.active = false;
	B2heart = new grabbable(801, 429, B2heartRadius, false, B2HEART, body2_heart_severed);
			grabbables.push(B2heart);
	B2heart.active = false;
	toss(B2heart);
	B2flap = new grabbable(801, 429, B2flapRadius, false, B2FLAP, body2flap);
			grabbables.push(B2flap);
	B2flap.active = false;
	B2skin = new grabbable(801, 429, B2skinRadius, false, B2SKIN, null);
			grabbables.push(B2skin);
	B2skin.active = false;
	toss(B2skin);
	B2skin.movable = false;
	B2rib = new grabbable(801, 429, B2ribRadius, false, B2RIB, null);
			grabbables.push(B2rib);
	B2rib.active = false;
	toss(B2rib);
	//B2rib.movable = false;
}

function setupBody3()
{
	B3guts = new grabbable(885, 485, B3gutsRadius, false, B3GUTS, body3_guts_severed);
    grabbables.push(B3guts);
	B3guts.active = false;
	toss(B3guts);
	B3brain = new grabbable(647, 242, B3brainRadius, false, B3BRAIN, body3_brain_severed);
			grabbables.push(B3brain);
	B3brain.active = false;
	toss(B3brain);
	B3foot = new grabbable(736, 868, B3footRadius, false, B3FOOT, body3_foot_severed);
			grabbables.push(B3foot);
	B3foot.active = false;
	B3flap = new grabbable(885, 485, B3flapRadius, false, B3FLAP, body3flap);
			grabbables.push(B3flap);
	B3flap.active = false;
	B3skin = new grabbable(885, 485, B3skinRadius, false, B3SKIN, null);
			grabbables.push(B3skin);
	B3skin.active = false;
	toss(B3skin);
	//B3skin.movable = false;
	B3skull = new grabbable(647, 242, B3skullRadius, false, B3SKULL, null);
			grabbables.push(B3skull);
	B3skull.active = false;
	//B3skull.movable = false;
}

function setBodyGrabbablesActive(bodyNum, isActive) {
	let ids = [];
	if (bodyNum === 1) {
		ids = [B1FLAP, B1ARM, B1LEG1, B1LEG2, B1EYEBALL, B1EYEBALL2];
	} else if (bodyNum === 2) {
		ids = [B2HAND, B2KNEE, B2HEART, B2FLAP, B2SKIN, B2RIB];
	} else if (bodyNum === 3) {
		ids = [B3GUTS, B3BRAIN, B3FOOT, B3FLAP, B3SKIN, B3SKULL];
	}
	for (let i = 0; i < ids.length; i++) {
		const g = grabbables[ids[i]];
		if (g) {
			if (!isActive && g.hasBeenGrabbed) {
				g.active = true;
			} else {
				g.active = isActive;
			}
		}
	}
}


// grabbable constants
const B1FLAP = 0;
B1flapRadius = 250;
const B1ARM = 1;
B1armRadius = 160;
const B1LEG1 = 2;
B1leg1Radius = 150;
const B1LEG2 = 3;
B1leg2Radius = 190;
const B1EYEBALL = 4;
B1eyeballRadius = 50;
const B1EYEBALL2 = 5;
B1eyeball2Radius = 50;
const SCALPELG = 6;
scalpelRadius = 180;
scalpelX = 1320;
scalpelY = 295;
const BONESAWG = 7;
bonesawX = 1333;
bonesawY = 571;
bonesawRadius = 240;
const HAMMERG = 8;
hammerX = 1324;
hammerY = 883;
hammerRadius = 170;
const B2HAND = 9;
B2handRadius = 170;
const B2KNEE = 10;
B2kneeRadius = 220;
const B2HEART = 11;
B2heartRadius = 120;
const B2FLAP = 12;
B2flapRadius = 250;
const B2SKIN = 13;
B2skinRadius = 140;
const B2RIB = 14;
B2ribRadius = 140;
const B3GUTS = 15;
B3gutsRadius = 140;
const B3BRAIN = 16;
B3brainRadius = 150;
const B3FOOT = 17;
B3footRadius = 140;
const B3FLAP = 18;
B3flapRadius = 250;
const B3SKIN = 19;
B3skinRadius = 180;
const B3SKULL = 20;
B3skullRadius = 150;


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
