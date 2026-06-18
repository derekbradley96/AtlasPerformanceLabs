/**
 * One-shot generator: writes src/data/exercises/exerciseLibraryExtended.js
 * Run: node scripts/generate-exercise-library-extended.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, '../src/data/exercises/exerciseLibraryExtended.js');

const E = (id, name, primaryMuscle, movementPattern, equipment, secondaryMuscles = [], tags = [], substitutions = []) => ({
  id,
  name,
  primaryMuscle,
  secondaryMuscles,
  movementPattern,
  equipment,
  tags,
  substitutions,
});

const rows = [];
function ex(...args) {
  rows.push(E(...args));
}

const BP = ['ex-bp', 'ex-dbp'];
const CHEST_ISO = ['ex-cable-fly', 'ex-db-fly', 'ex-pec-deck'];
const ROW = ['ex-row-bb', 'ex-cable-row', 'ex-row-db'];
const PULL = ['ex-pulldown', 'ex-pullup'];
const DL = ['ex-deadlift', 'ex-rdl'];
const OHP = ['ex-ohp', 'ex-db-ohp'];
const SQ = ['ex-squat', 'ex-leg-press', 'ex-front-squat'];
const LEGCURL = ['ex-leg-curl', 'ex-lying-leg-curl', 'ex-seated-leg-curl'];
const HIP = ['ex-hip-thrust', 'ex-glute-bridge'];
const CALF = ['ex-calf-raise', 'ex-seated-calf'];
const CURL = ['ex-barbell-curl', 'ex-db-curl', 'ex-hammer-curl'];
const TRI = ['ex-tricep-pushdown', 'ex-overhead-ext', 'ex-skull-crusher'];
const CORE = ['ex-plank', 'ex-crunch', 'ex-deadbug'];
const FACE = ['ex-face-pull', 'ex-rear-delt'];

// --- CHEST (new / variant) ---
ex('ex-decline-db-press', 'Decline Dumbbell Press', 'Chest', 'Push', ['Dumbbell'], ['Triceps', 'Shoulders'], ['compound', 'bodybuilding'], [...BP, 'ex-decline-bp']);
ex('ex-low-cable-fly', 'Low Cable Fly', 'Chest', 'Isolation', ['Cable'], ['Shoulders'], ['isolation', 'bodybuilding'], CHEST_ISO);
ex('ex-high-cable-fly', 'High Cable Fly', 'Chest', 'Isolation', ['Cable'], ['Shoulders'], ['isolation', 'bodybuilding'], CHEST_ISO);
ex('ex-incline-cable-fly', 'Incline Cable Fly', 'Chest', 'Isolation', ['Cable'], ['Shoulders'], ['isolation', 'bodybuilding'], CHEST_ISO);
ex('ex-landmine-press-chest', 'Landmine Press', 'Chest', 'Push', ['Barbell'], ['Shoulders', 'Triceps'], ['compound', 'strength', 'bodybuilding'], ['ex-incline-bp', 'ex-ohp']);
ex('ex-smith-bench', 'Smith Machine Bench Press', 'Chest', 'Push', ['Smith Machine'], ['Triceps', 'Shoulders'], ['compound', 'bodybuilding'], BP);
ex('ex-svend-press', 'Svend Press', 'Chest', 'Isolation', ['Other'], ['Shoulders'], ['isolation', 'bodybuilding'], CHEST_ISO);
ex('ex-squeeze-press', 'Squeeze Press', 'Chest', 'Push', ['Dumbbell'], ['Triceps'], ['compound', 'bodybuilding'], ['ex-dbp']);
ex('ex-pushup-plus', 'Push-up Plus', 'Chest', 'Push', ['Bodyweight'], ['Shoulders', 'Core'], ['bodybuilding'], ['ex-pushup']);
ex('ex-diamond-pushup-chest', 'Diamond Push-up (chest emphasis)', 'Chest', 'Push', ['Bodyweight'], ['Triceps'], ['bodybuilding'], ['ex-pushup', 'ex-diamond-pushup']);
ex('ex-archer-pushup', 'Archer Push-up', 'Chest', 'Push', ['Bodyweight'], ['Shoulders', 'Triceps'], ['unilateral', 'strength', 'bodybuilding'], ['ex-pushup']);
ex('ex-db-pullover-chest', 'Dumbbell Pullover (chest focus)', 'Chest', 'Isolation', ['Dumbbell'], ['Back'], ['isolation', 'bodybuilding'], ['ex-pullover', 'ex-db-fly']);
ex('ex-incline-pushup', 'Incline Push-up', 'Chest', 'Push', ['Bodyweight'], ['Shoulders'], ['bodybuilding'], ['ex-pushup']);
ex('ex-single-arm-cable-fly', 'Single Arm Cable Fly', 'Chest', 'Isolation', ['Cable'], ['Core'], ['unilateral', 'isolation', 'bodybuilding'], ['ex-cable-fly']);
ex('ex-plate-press', 'Plate Press', 'Chest', 'Push', ['Other'], ['Triceps'], ['compound', 'strength'], BP);
ex('ex-guillotine-press', 'Guillotine Press', 'Chest', 'Push', ['Barbell'], ['Shoulders'], ['compound', 'bodybuilding'], ['ex-bp']);

// --- BACK ---
ex('ex-rack-pull', 'Rack Pull', 'Back', 'Hinge', ['Barbell'], ['Traps', 'Hamstrings'], ['compound', 'strength', 'bodybuilding'], DL);
ex('ex-sumo-deadlift', 'Sumo Deadlift', 'Back', 'Hinge', ['Barbell'], ['Glutes', 'Quads'], ['compound', 'strength'], DL);
ex('ex-pendlay-row', 'Pendlay Row', 'Back', 'Pull', ['Barbell'], ['Biceps', 'Core'], ['compound', 'strength'], ROW);
ex('ex-meadows-row', 'Meadows Row', 'Back', 'Pull', ['Barbell', 'Dumbbell'], ['Biceps'], ['unilateral', 'compound'], ['ex-row-db']);
ex('ex-machine-row', 'Machine Row', 'Back', 'Pull', ['Machine'], ['Biceps'], ['compound', 'bodybuilding'], ['ex-cable-row']);
ex('ex-chest-supported-row', 'Chest Supported Row', 'Back', 'Pull', ['Dumbbell', 'Machine'], ['Biceps'], ['compound'], ROW);
ex('ex-incline-db-row', 'Incline Dumbbell Row', 'Back', 'Pull', ['Dumbbell'], ['Biceps'], ['compound'], ['ex-row-db']);
ex('ex-wide-pulldown', 'Wide Grip Pulldown', 'Back', 'Pull', ['Cable', 'Machine'], ['Biceps'], ['compound'], ['ex-pulldown']);
ex('ex-reverse-grip-pulldown', 'Reverse Grip Pulldown', 'Back', 'Pull', ['Cable'], ['Biceps'], ['compound'], ['ex-pulldown']);
ex('ex-single-arm-pulldown', 'Single Arm Pulldown', 'Back', 'Pull', ['Cable'], ['Biceps'], ['unilateral', 'isolation'], ['ex-pulldown']);
ex('ex-pullup-weighted', 'Pull-up (weighted)', 'Back', 'Pull', ['Bodyweight', 'Other'], ['Biceps', 'Core'], ['compound', 'strength'], ['ex-pullup']);
ex('ex-band-pull-apart-back', 'Band Pull-apart', 'Back', 'Isolation', ['Band'], ['Shoulders'], ['isolation', 'bodybuilding'], ['ex-face-pull']);
ex('ex-low-cable-row', 'Low Cable Row', 'Back', 'Pull', ['Cable'], ['Biceps'], ['compound'], ['ex-cable-row']);
ex('ex-high-cable-row', 'High Cable Row', 'Back', 'Pull', ['Cable'], ['Biceps', 'Shoulders'], ['compound'], ['ex-cable-row']);
ex('ex-supinated-cable-row', 'Supinated Cable Row', 'Back', 'Pull', ['Cable'], ['Biceps'], ['compound'], ['ex-cable-row']);
ex('ex-kb-hip-hinge', 'Hip Hinge (kettlebell)', 'Back', 'Hinge', ['Kettlebell'], ['Hamstrings', 'Glutes'], ['compound', 'strength'], ['ex-rdl']);
ex('ex-back-extension', 'Back Extension', 'Back', 'Isolation', ['Machine', 'Bodyweight'], ['Glutes', 'Hamstrings'], ['isolation', 'bodybuilding'], ['ex-glute-ham']);
ex('ex-hyperextension', 'Hyperextension', 'Back', 'Hinge', ['Bodyweight', 'Machine'], ['Glutes', 'Hamstrings'], ['isolation'], ['ex-back-extension']);
ex('ex-banded-good-morning', 'Banded Good Morning', 'Back', 'Hinge', ['Band'], ['Hamstrings', 'Glutes'], ['compound'], ['ex-good-morning']);
ex('ex-reverse-hyper', 'Reverse Hyper', 'Back', 'Isolation', ['Machine', 'Bodyweight'], ['Glutes', 'Hamstrings'], ['isolation'], ['ex-glute-ham']);
ex('ex-ghd-hip-extension', 'GHD Hip Extension', 'Back', 'Hinge', ['Machine'], ['Glutes', 'Hamstrings'], ['isolation'], ['ex-glute-ham']);

// --- SHOULDERS ---
ex('ex-machine-shoulder-press', 'Machine Shoulder Press', 'Shoulders', 'Push', ['Machine'], ['Triceps'], ['compound', 'bodybuilding'], OHP);
ex('ex-cable-upright-row', 'Cable Upright Row', 'Shoulders', 'Pull', ['Cable'], ['Traps', 'Biceps'], ['compound'], ['ex-upright-row']);
ex('ex-plate-front-raise', 'Plate Front Raise', 'Shoulders', 'Isolation', ['Plate', 'Other'], ['Chest'], ['isolation'], ['ex-front-raise']);
ex('ex-ez-upright-row', 'EZ Bar Upright Row', 'Shoulders', 'Pull', ['Barbell'], ['Traps', 'Biceps'], ['compound'], ['ex-upright-row']);
ex('ex-leaning-lateral-raise', 'Leaning Lateral Raise', 'Shoulders', 'Isolation', ['Dumbbell'], [], ['isolation', 'bodybuilding'], ['ex-lateral-raise']);
ex('ex-cross-body-lateral-raise', 'Cross-body Lateral Raise', 'Shoulders', 'Isolation', ['Dumbbell'], [], ['unilateral', 'isolation'], ['ex-lateral-raise']);
ex('ex-w-press', 'W-Press', 'Shoulders', 'Push', ['Dumbbell'], ['Triceps'], ['compound'], OHP);
ex('ex-y-press', 'Y-Press', 'Shoulders', 'Push', ['Dumbbell'], ['Triceps'], ['compound'], OHP);
ex('ex-face-pull-rope', 'Face Pull (rope)', 'Shoulders', 'Pull', ['Cable'], ['Shoulders'], ['isolation'], FACE);
ex('ex-prone-ytw', 'Prone Y-T-W', 'Shoulders', 'Isolation', ['Bodyweight'], ['Back'], ['isolation', 'bodybuilding'], ['ex-rear-delt']);
ex('ex-band-pull-apart-shoulder', 'Band Pull-apart (Shoulders)', 'Shoulders', 'Isolation', ['Band'], ['Back'], ['isolation'], FACE);
ex('ex-behind-neck-press', 'Behind the Neck Press', 'Shoulders', 'Push', ['Barbell'], ['Triceps'], ['compound', 'strength'], ['ex-ohp']);
ex('ex-push-press', 'Push Press', 'Shoulders', 'Push', ['Barbell', 'Dumbbell'], ['Triceps', 'Quads'], ['compound', 'strength'], OHP);
ex('ex-db-lateral-unilateral', 'Dumbbell Lateral Raise (unilateral)', 'Shoulders', 'Isolation', ['Dumbbell'], [], ['unilateral', 'isolation'], ['ex-lateral-raise']);
ex('ex-cable-front-raise', 'Cable Front Raise', 'Shoulders', 'Isolation', ['Cable'], [], ['isolation'], ['ex-front-raise']);
ex('ex-machine-lateral-raise', 'Machine Lateral Raise', 'Shoulders', 'Isolation', ['Machine'], [], ['isolation'], ['ex-lateral-raise']);
ex('ex-rear-delt-machine', 'Rear Delt Machine', 'Shoulders', 'Isolation', ['Machine'], ['Back'], ['isolation'], ['ex-rear-delt']);
ex('ex-incline-rear-delt-raise', 'Incline Rear Delt Raise', 'Shoulders', 'Isolation', ['Dumbbell'], ['Back'], ['isolation'], ['ex-rear-delt']);
ex('ex-landmine-lateral-raise', 'Landmine Lateral Raise', 'Shoulders', 'Isolation', ['Barbell'], ['Traps'], ['isolation'], ['ex-lateral-raise']);

// --- QUADS ---
ex('ex-smith-squat', 'Smith Machine Squat', 'Quads', 'Squat', ['Smith Machine'], ['Glutes', 'Core'], ['compound', 'strength'], SQ);
ex('ex-pause-squat', 'Pause Squat', 'Quads', 'Squat', ['Barbell'], ['Glutes', 'Core'], ['compound', 'strength'], ['ex-squat']);
ex('ex-safety-bar-squat', 'Safety Bar Squat', 'Quads', 'Squat', ['Barbell'], ['Glutes', 'Core'], ['compound', 'strength'], SQ);
ex('ex-zercher-squat', 'Zercher Squat', 'Quads', 'Squat', ['Barbell'], ['Core', 'Glutes'], ['compound', 'strength'], SQ);
ex('ex-cyclist-squat', 'Cyclist Squat', 'Quads', 'Squat', ['Barbell', 'Smith Machine'], ['Glutes'], ['compound'], SQ);
ex('ex-single-leg-press', 'Single Leg Press', 'Quads', 'Squat', ['Machine'], ['Glutes'], ['unilateral', 'compound'], ['ex-leg-press']);
ex('ex-reverse-lunge', 'Reverse Lunge', 'Quads', 'Lunge', ['Dumbbell', 'Barbell', 'Bodyweight'], ['Glutes'], ['compound'], ['ex-lunge']);
ex('ex-lateral-lunge', 'Lateral Lunge', 'Quads', 'Lunge', ['Dumbbell', 'Bodyweight'], ['Glutes'], ['compound'], ['ex-lunge']);
ex('ex-cossack-squat', 'Cossack Squat', 'Quads', 'Lunge', ['Bodyweight', 'Dumbbell'], ['Glutes', 'Hamstrings'], ['compound', 'mobility'], ['ex-lunge']);
ex('ex-terminal-knee-extension', 'Terminal Knee Extension', 'Quads', 'Isolation', ['Band', 'Cable'], ['Calves'], ['isolation'], ['ex-leg-extension']);
ex('ex-wall-sit', 'Wall Sit', 'Quads', 'Isolation', ['Bodyweight'], ['Glutes'], ['isolation', 'conditioning'], SQ);
ex('ex-leg-press-wide', 'Leg Press (wide stance)', 'Quads', 'Squat', ['Machine'], ['Glutes'], ['compound'], ['ex-leg-press']);
ex('ex-leg-press-narrow', 'Leg Press (narrow stance)', 'Quads', 'Squat', ['Machine'], ['Quads'], ['compound'], ['ex-leg-press']);
ex('ex-hack-squat-barbell', 'Hack Squat (barbell)', 'Quads', 'Squat', ['Barbell'], ['Glutes'], ['compound'], SQ);
ex('ex-spanish-squat', 'Spanish Squat (band)', 'Quads', 'Squat', ['Band', 'Barbell'], ['Glutes'], ['compound'], SQ);
ex('ex-short-step-lunge', 'Short Step Lunge', 'Quads', 'Lunge', ['Dumbbell', 'Bodyweight'], ['Glutes'], ['compound'], ['ex-lunge']);
ex('ex-reverse-step-up', 'Reverse Step-Up', 'Quads', 'Lunge', ['Dumbbell', 'Bodyweight'], ['Glutes'], ['compound'], ['ex-step-up']);

// --- HAMSTRINGS ---
ex('ex-single-leg-lying-curl', 'Single Leg Lying Curl', 'Hamstrings', 'Isolation', ['Machine'], [], ['unilateral', 'isolation'], LEGCURL);
ex('ex-single-leg-seated-curl', 'Single Leg Seated Curl', 'Hamstrings', 'Isolation', ['Machine'], [], ['unilateral', 'isolation'], LEGCURL);
ex('ex-db-leg-curl', 'Dumbbell Leg Curl', 'Hamstrings', 'Isolation', ['Dumbbell', 'Machine'], [], ['isolation'], LEGCURL);
ex('ex-band-leg-curl', 'Band Leg Curl', 'Hamstrings', 'Isolation', ['Band'], [], ['isolation'], LEGCURL);
ex('ex-stiff-leg-deadlift', 'Stiff Leg Deadlift', 'Hamstrings', 'Hinge', ['Barbell'], ['Back', 'Glutes'], ['compound', 'bodybuilding'], ['ex-rdl-ham']);
ex('ex-pause-rdl', 'Pause RDL', 'Hamstrings', 'Hinge', ['Barbell', 'Dumbbell'], ['Glutes', 'Back'], ['compound', 'strength'], ['ex-rdl-ham']);
ex('ex-single-leg-rdl-barbell', 'Single Leg RDL (barbell)', 'Hamstrings', 'Hinge', ['Barbell'], ['Glutes'], ['unilateral', 'compound'], ['ex-single-leg-rdl']);
ex('ex-kettlebell-swing', 'Kettlebell Swing', 'Hamstrings', 'Hinge', ['Kettlebell'], ['Glutes', 'Back'], ['compound', 'conditioning'], ['ex-rdl-ham']);
ex('ex-banded-rdl', 'Banded RDL', 'Hamstrings', 'Hinge', ['Band', 'Barbell'], ['Glutes'], ['compound'], ['ex-rdl-ham']);
ex('ex-hip-extension-machine', 'Hip Extension Machine', 'Hamstrings', 'Isolation', ['Machine'], ['Glutes'], ['isolation'], HIP);
ex('ex-inverse-curl', 'Inverse Curl', 'Hamstrings', 'Isolation', ['Machine', 'Bodyweight'], [], ['isolation', 'strength'], ['ex-nordic']);
ex('ex-manual-nordic', 'Manual Nordic Curl', 'Hamstrings', 'Isolation', ['Bodyweight'], [], ['compound'], ['ex-nordic']);
ex('ex-russian-leg-curl', 'Russian Leg Curl', 'Hamstrings', 'Isolation', ['Bodyweight'], [], ['isolation'], ['ex-nordic']);

// --- GLUTES ---
ex('ex-banded-hip-thrust', 'Banded Hip Thrust', 'Glutes', 'Hinge', ['Band', 'Barbell'], ['Hamstrings'], ['compound'], HIP);
ex('ex-single-leg-hip-thrust', 'Single Leg Hip Thrust', 'Glutes', 'Hinge', ['Barbell', 'Bodyweight'], ['Hamstrings'], ['unilateral', 'compound'], HIP);
ex('ex-american-hip-thrust', 'American Hip Thrust', 'Glutes', 'Hinge', ['Barbell'], ['Hamstrings'], ['compound'], HIP);
ex('ex-hip-thrust-machine', 'Hip Thrust Machine', 'Glutes', 'Hinge', ['Machine'], ['Hamstrings'], ['compound'], HIP);
ex('ex-cable-pull-through', 'Cable Pull-Through', 'Glutes', 'Hinge', ['Cable'], ['Hamstrings'], ['compound'], HIP);
ex('ex-banded-clamshell', 'Banded Clamshell', 'Glutes', 'Isolation', ['Band'], [], ['isolation'], ['ex-frog-pump']);
ex('ex-fire-hydrant', 'Fire Hydrant', 'Glutes', 'Isolation', ['Bodyweight', 'Band'], [], ['isolation'], ['ex-cable-kickback']);
ex('ex-donkey-kick-cable', 'Donkey Kick (cable)', 'Glutes', 'Isolation', ['Cable'], [], ['isolation'], ['ex-cable-kickback']);
ex('ex-abductor-machine', 'Abductor Machine', 'Glutes', 'Isolation', ['Machine'], [], ['isolation'], ['ex-hip-abduction']);
ex('ex-single-leg-glute-bridge', 'Single Leg Glute Bridge', 'Glutes', 'Hinge', ['Bodyweight', 'Barbell'], ['Hamstrings'], ['unilateral'], ['ex-glute-bridge']);
ex('ex-romanian-hip-thrust', 'Romanian Hip Thrust', 'Glutes', 'Hinge', ['Barbell'], ['Hamstrings'], ['compound'], HIP);
ex('ex-bulgarian-glute', 'Bulgarian Split Squat (glute focus)', 'Glutes', 'Lunge', ['Dumbbell'], ['Quads'], ['compound'], ['ex-bulgarian']);
ex('ex-sumo-walk-band', 'Sumo Walk (band)', 'Glutes', 'Lunge', ['Band'], ['Quads'], ['conditioning'], ['ex-curtsy-lunge']);
ex('ex-x-band-walk', 'X-Band Walk', 'Glutes', 'Isolation', ['Band'], ['Quads'], ['conditioning'], ['ex-sumo-walk-band']);
ex('ex-quadruped-hip-extension', 'Quadruped Hip Extension', 'Glutes', 'Isolation', ['Bodyweight'], ['Hamstrings'], ['isolation'], ['ex-cable-kickback']);

// --- CALVES ---
ex('ex-smith-calf-raise', 'Smith Machine Calf Raise', 'Calves', 'Isolation', ['Smith Machine'], [], ['isolation'], CALF);
ex('ex-tibialis-raise', 'Tibialis Raise', 'Calves', 'Isolation', ['Dumbbell', 'Machine'], ['Calves'], ['isolation'], ['ex-calf-raise']);
ex('ex-reverse-calf-raise', 'Reverse Calf Raise', 'Calves', 'Isolation', ['Machine', 'Smith Machine'], [], ['isolation'], CALF);
ex('ex-jump-rope', 'Jump Rope', 'Calves', 'Plyometric', ['Other'], ['Core'], ['cardio', 'conditioning'], ['ex-calf-raise']);
ex('ex-box-jump-calf', 'Box Jump (calf focus)', 'Calves', 'Plyometric', ['Bodyweight', 'Other'], ['Quads'], ['plyometric', 'conditioning'], ['ex-calf-raise']);
ex('ex-calf-press-single', 'Calf Press (single leg)', 'Calves', 'Isolation', ['Machine'], [], ['unilateral', 'isolation'], ['ex-calf-leg-press']);
ex('ex-explosive-calf-raise', 'Explosive Calf Raise', 'Calves', 'Plyometric', ['Machine', 'Bodyweight'], [], ['plyometric', 'conditioning'], CALF);

// --- BICEPS (add beyond core) ---
ex('ex-ez-bar-curl', 'EZ Bar Curl', 'Biceps', 'Isolation', ['Barbell'], ['Forearms'], ['isolation', 'bodybuilding'], CURL);
ex('ex-cable-hammer-curl', 'Cable Hammer Curl', 'Biceps', 'Isolation', ['Cable'], ['Forearms'], ['isolation'], ['ex-hammer-curl']);
ex('ex-cross-body-curl', 'Cross Body Curl', 'Biceps', 'Isolation', ['Dumbbell'], [], ['isolation'], ['ex-db-curl']);
ex('ex-zottman-curl', 'Zottman Curl', 'Biceps', 'Isolation', ['Dumbbell'], ['Forearms'], ['isolation'], ['ex-db-curl']);
ex('ex-machine-curl', 'Machine Curl', 'Biceps', 'Isolation', ['Machine'], [], ['isolation'], CURL);
ex('ex-trx-curl', 'TRX Curl', 'Biceps', 'Isolation', ['TRX'], ['Core'], ['isolation'], ['ex-db-curl']);
ex('ex-band-curl', 'Band Curl', 'Biceps', 'Isolation', ['Band'], [], ['isolation'], CURL);
ex('ex-overhead-cable-curl', 'Overhead Cable Curl', 'Biceps', 'Isolation', ['Cable'], [], ['isolation'], ['ex-cable-curl']);
ex('ex-single-arm-preacher', 'Single Arm Preacher Curl', 'Biceps', 'Isolation', ['Dumbbell', 'Machine'], [], ['unilateral', 'isolation'], ['ex-preacher']);

// --- TRICEPS ---
ex('ex-skull-ez', 'Skullcrusher (EZ bar)', 'Triceps', 'Isolation', ['Barbell'], [], ['isolation'], ['ex-skull-crusher']);
ex('ex-overhead-tri-db', 'Overhead Tricep Extension (dumbbell)', 'Triceps', 'Isolation', ['Dumbbell'], [], ['isolation'], ['ex-overhead-ext']);
ex('ex-overhead-tri-cable', 'Overhead Tricep Extension (cable)', 'Triceps', 'Isolation', ['Cable'], [], ['isolation'], ['ex-overhead-ext']);
ex('ex-overhead-tri-ez', 'Overhead Tricep Extension (EZ bar)', 'Triceps', 'Isolation', ['Barbell'], [], ['isolation'], ['ex-overhead-ext']);
ex('ex-single-arm-overhead-tri', 'Single Arm Overhead Extension', 'Triceps', 'Isolation', ['Dumbbell', 'Cable'], [], ['unilateral', 'isolation'], ['ex-overhead-ext']);
ex('ex-cable-pushdown-rope', 'Cable Pushdown (rope)', 'Triceps', 'Isolation', ['Cable'], [], ['isolation'], ['ex-tricep-pushdown']);
ex('ex-cable-pushdown-bar', 'Cable Pushdown (bar)', 'Triceps', 'Isolation', ['Cable'], [], ['isolation'], ['ex-tricep-pushdown']);
ex('ex-reverse-cable-pushdown', 'Reverse Cable Pushdown', 'Triceps', 'Isolation', ['Cable'], [], ['isolation'], ['ex-tricep-pushdown']);
ex('ex-machine-tri-extension', 'Machine Tricep Extension', 'Triceps', 'Isolation', ['Machine'], [], ['isolation'], TRI);
ex('ex-dip-tri-focus', 'Dip (tricep focus)', 'Triceps', 'Push', ['Bodyweight', 'Machine'], ['Chest'], ['compound'], ['ex-tricep-dip']);
ex('ex-bodyweight-tri-floor', 'Bodyweight Extension (floor)', 'Triceps', 'Isolation', ['Bodyweight'], [], ['isolation'], ['ex-tricep-pushdown']);
ex('ex-band-pushdown', 'Band Pushdown', 'Triceps', 'Isolation', ['Band'], [], ['isolation'], ['ex-tricep-pushdown']);
ex('ex-diamond-pushup-tri', 'Diamond Push-up (tricep focus)', 'Triceps', 'Push', ['Bodyweight'], ['Chest'], ['isolation', 'bodybuilding'], ['ex-diamond-pushup']);

// --- CORE (add beyond core list) ---
ex('ex-side-plank', 'Side Plank', 'Core', 'Isolation', ['Bodyweight'], ['Shoulders'], ['isolation', 'strength'], ['ex-plank']);
ex('ex-rkc-plank', 'RKC Plank', 'Core', 'Isolation', ['Bodyweight'], [], ['isolation', 'strength'], ['ex-plank']);
ex('ex-dragon-flag', 'Dragon Flag', 'Core', 'Isolation', ['Bodyweight'], ['Back'], ['isolation', 'advanced'], ['ex-hanging-leg']);
ex('ex-toes-to-bar', 'Toes to Bar', 'Core', 'Isolation', ['Bodyweight'], ['Back'], ['compound'], ['ex-hanging-leg']);
ex('ex-cable-crunch', 'Cable Crunch', 'Core', 'Isolation', ['Cable'], [], ['isolation'], ['ex-crunch']);
ex('ex-machine-crunch', 'Machine Crunch', 'Core', 'Isolation', ['Machine'], [], ['isolation'], ['ex-crunch']);
ex('ex-decline-crunch', 'Decline Crunch', 'Core', 'Isolation', ['Bodyweight', 'Machine'], [], ['isolation'], ['ex-crunch']);
ex('ex-hollow-body', 'Hollow Body Hold', 'Core', 'Isolation', ['Bodyweight'], [], ['isolation', 'strength'], ['ex-deadbug']);
ex('ex-v-up', 'V-Up', 'Core', 'Isolation', ['Bodyweight'], [], ['isolation', 'conditioning'], ['ex-crunch']);
ex('ex-landmine-rotation', 'Landmine Rotation', 'Core', 'Rotation', ['Barbell'], ['Shoulders'], ['rotation', 'strength'], ['ex-pallof']);
ex('ex-copenhagen-plank', 'Copenhagen Plank', 'Core', 'Isolation', ['Bodyweight'], ['Glutes'], ['isolation'], ['ex-side-plank']);
ex('ex-mcgill-curl-up', 'McGill Curl-Up', 'Core', 'Isolation', ['Bodyweight'], [], ['isolation', 'recovery'], ['ex-crunch']);
ex('ex-stir-the-pot', 'Stir the Pot (ball)', 'Core', 'Isolation', ['Medicine Ball', 'Other'], ['Shoulders'], ['isolation', 'strength'], ['ex-plank']);
ex('ex-single-arm-farmer', 'Single Arm Farmer Carry', 'Core', 'Carry', ['Dumbbell', 'Kettlebell'], ['Traps'], ['unilateral', 'strength'], ['ex-suitcase-carry']);

// --- FOREARMS ---
ex('ex-wrist-curl-barbell', 'Wrist Curl (barbell)', 'Forearms', 'Isolation', ['Barbell'], [], ['isolation'], ['ex-wrist-curl']);
ex('ex-wrist-curl-db', 'Wrist Curl (dumbbell)', 'Forearms', 'Isolation', ['Dumbbell'], [], ['isolation'], ['ex-wrist-curl']);
ex('ex-reverse-wrist-curl', 'Reverse Wrist Curl', 'Forearms', 'Isolation', ['Barbell', 'Dumbbell'], [], ['isolation'], ['ex-reverse-curl']);
ex('ex-farmer-walk-forearm', 'Farmer Walk (forearm)', 'Forearms', 'Carry', ['Dumbbell', 'Kettlebell'], ['Traps', 'Core'], ['strength'], ['ex-farmers-walk']);
ex('ex-plate-pinch', 'Plate Pinch', 'Forearms', 'Isolation', ['Other'], [], ['isolation', 'strength'], []);
ex('ex-towel-pullup', 'Towel Pull-up', 'Forearms', 'Pull', ['Bodyweight'], ['Back', 'Biceps'], ['compound'], ['ex-pullup']);
ex('ex-fat-bar-curl', 'Fat Bar Curl', 'Forearms', 'Isolation', ['Barbell'], ['Biceps'], ['isolation'], ['ex-barbell-curl']);
ex('ex-wrist-roller', 'Wrist Roller', 'Forearms', 'Isolation', ['Other'], [], ['isolation'], ['ex-wrist-curl']);

// --- TRAPS ---
ex('ex-db-shrug', 'Dumbbell Shrug', 'Traps', 'Isolation', ['Dumbbell'], ['Shoulders'], ['isolation', 'bodybuilding'], ['ex-shrug']);
ex('ex-cable-shrug', 'Cable Shrug', 'Traps', 'Isolation', ['Cable'], ['Back'], ['isolation'], ['ex-shrug']);
ex('ex-machine-shrug', 'Machine Shrug', 'Traps', 'Isolation', ['Machine'], [], ['isolation'], ['ex-shrug']);
ex('ex-behind-back-shrug', 'Behind the Back Barbell Shrug', 'Traps', 'Isolation', ['Barbell'], ['Back'], ['isolation'], ['ex-shrug']);
ex('ex-trap-bar-shrug', 'Trap Bar Shrug', 'Traps', 'Isolation', ['Barbell'], [], ['isolation'], ['ex-shrug']);
ex('ex-rack-pull-trap', 'Rack Pull (trap focus)', 'Traps', 'Hinge', ['Barbell'], ['Back'], ['compound', 'strength'], ['ex-rack-pull']);
ex('ex-power-shrug', 'Power Shrug', 'Traps', 'Hinge', ['Barbell', 'Dumbbell'], ['Back'], ['compound', 'strength'], ['ex-shrug']);
ex('ex-barbell-face-pull', 'Barbell Face Pull', 'Traps', 'Pull', ['Barbell'], ['Shoulders'], ['isolation'], FACE);

// --- CARDIO ---
const cardio = (id, name, equip) =>
  ex(id, name, 'Full body', 'Other', equip, [], ['cardio', 'conditioning'], []);
cardio('ex-bike-ss', 'Stationary Bike (steady state)', ['Machine']);
cardio('ex-bike-int', 'Stationary Bike (intervals)', ['Machine']);
cardio('ex-treadmill-walk-incline', 'Treadmill Walk (incline)', ['Machine']);
cardio('ex-treadmill-run', 'Treadmill Run', ['Machine']);
cardio('ex-stairmaster', 'Stairmaster', ['Machine']);
cardio('ex-elliptical', 'Elliptical', ['Machine']);
cardio('ex-rowing-machine', 'Rowing Machine', ['Machine']);
cardio('ex-ski-erg', 'Ski Erg', ['Machine']);
cardio('ex-air-bike', 'Air Bike', ['Machine']);
cardio('ex-battle-ropes', 'Battle Ropes', ['Other']);
cardio('ex-box-jump', 'Box Jump', ['Bodyweight', 'Other']);
cardio('ex-burpee', 'Burpee', ['Bodyweight']);
cardio('ex-jump-rope-steady', 'Jump Rope (steady)', ['Other']);
cardio('ex-jump-rope-int', 'Jump Rope (intervals)', ['Other']);
cardio('ex-sled-push', 'Sled Push', ['Other']);
cardio('ex-sled-pull', 'Sled Pull', ['Other']);
cardio('ex-farmers-walk-cond', 'Farmers Walk (conditioning)', ['Dumbbell', 'Kettlebell']);
cardio('ex-bear-crawl', 'Bear Crawl', ['Bodyweight']);
cardio('ex-mountain-climber-cond', 'Mountain Climber', ['Bodyweight']);
cardio('ex-jumping-jack', 'Jumping Jack', ['Bodyweight']);
cardio('ex-high-knees', 'High Knees', ['Bodyweight']);
cardio('ex-sprint-treadmill', 'Sprint Intervals (treadmill)', ['Machine']);
cardio('ex-sprint-track', 'Sprint Intervals (track)', ['Bodyweight', 'Other']);
cardio('ex-swimming-laps', 'Swimming Laps', ['Other']);
cardio('ex-cycling-outdoor', 'Cycling (outdoor)', ['Other']);

// --- POSING ---
const posing = (id, name) =>
  ex(id, name, 'Core', 'Isolation', ['Bodyweight'], [], ['posing_conditioning', 'comp_prep'], ['ex-plank']);
posing('ex-vacuum-hold', 'Vacuum Hold');
posing('ex-vacuum-standing', 'Stomach Vacuum (standing)');
posing('ex-vacuum-kneeling', 'Stomach Vacuum (kneeling)');
posing('ex-vacuum-lat-spread', 'Vacuum (lat spread position)');
posing('ex-iso-ab-hold', 'Isometric Ab Hold');
posing('ex-glute-squeeze-hold', 'Glute Squeeze Hold');
posing('ex-quad-flex-hold', 'Quad Flex Hold');
posing('ex-chest-flex-pec', 'Chest Flex (pec isolation)');
posing('ex-lateral-spread-hold', 'Lateral Spread Hold');
posing('ex-rear-lat-spread-practice', 'Rear Lat Spread Practice');
posing('ex-whole-body-flex-circuit', 'Whole Body Flex Circuit');
posing('ex-posing-practice-30', 'Posing Practice (30 min session)');

// --- MOBILITY ---
const mob = (id, name) =>
  ex(id, name, 'Full body', 'Other', ['Bodyweight'], [], ['mobility', 'flexibility', 'recovery'], []);
mob('ex-hip-flexor-stretch', 'Hip Flexor Stretch');
mob('ex-pigeon-pose', 'Pigeon Pose');
mob('ex-hamstring-stretch', 'Hamstring Stretch');
mob('ex-quad-stretch', 'Quad Stretch');
mob('ex-chest-stretch-doorway', 'Chest Stretch (doorway)');
mob('ex-lat-stretch-overhead', 'Lat Stretch (overhead)');
mob('ex-shoulder-capsule-stretch', 'Shoulder Capsule Stretch');
mob('ex-thoracic-extension-foam', 'Thoracic Extension (foam roller)');
mob('ex-thoracic-rotation', 'Thoracic Rotation');
mob('ex-9090-hip-stretch', '90/90 Hip Stretch');
mob('ex-couch-stretch', 'Couch Stretch');
mob('ex-worlds-greatest-stretch', "World's Greatest Stretch");
mob('ex-calf-stretch-wall', 'Calf Stretch (wall)');
mob('ex-ankle-circles', 'Ankle Circles');
mob('ex-neck-stretch', 'Neck Stretch');
mob('ex-wrist-circles', 'Wrist Circles');
mob('ex-cat-cow', 'Cat Cow');
mob('ex-child-pose-lat', "Child's Pose (lat stretch)");
mob('ex-thread-the-needle', 'Thread the Needle');
mob('ex-foam-roll-quads', 'Foam Roll (quads)');
mob('ex-foam-roll-it-band', 'Foam Roll (IT band)');
mob('ex-foam-roll-hamstrings', 'Foam Roll (hamstrings)');
mob('ex-foam-roll-upper-back', 'Foam Roll (upper back)');
mob('ex-lacrosse-ball-glutes', 'Lacrosse Ball (glutes)');

// --- Volume block: deterministic unique names ---
const muscleVol = [
  'Chest',
  'Back',
  'Shoulders',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Biceps',
  'Triceps',
  'Core',
  'Forearms',
  'Traps',
  'Full body',
];
const patternVol = ['Isolation', 'Push', 'Pull', 'Hinge', 'Squat', 'Lunge', 'Carry', 'Other', 'Rotation'];
const equipVol = ['Machine', 'Cable', 'Dumbbell', 'Barbell', 'Band', 'Bodyweight', 'Kettlebell', 'TRX'];
let nid = 20000;
for (const m of muscleVol) {
  for (let k = 1; k <= 35; k++) {
    nid += 1;
    const pat = patternVol[k % patternVol.length];
    const eq = [equipVol[k % equipVol.length]];
    const tags = ['isolation', 'bodybuilding'];
    let subs = ['ex-bp'];
    if (m === 'Back') subs = ROW;
    else if (m === 'Chest') subs = CHEST_ISO;
    else if (m === 'Shoulders') subs = OHP;
    else if (m === 'Quads') subs = SQ;
    else if (m === 'Hamstrings') subs = LEGCURL;
    else if (m === 'Glutes') subs = HIP;
    else if (m === 'Calves') subs = CALF;
    else if (m === 'Biceps') subs = CURL;
    else if (m === 'Triceps') subs = TRI;
    else if (m === 'Core') subs = CORE;
    else if (m === 'Forearms') subs = ['ex-wrist-curl'];
    else if (m === 'Traps') subs = ['ex-shrug'];
    else if (m === 'Full body') subs = ['ex-plank'];
    ex(`ex-vol-${nid}`, `${m} accessory line ${k}`, m, pat, eq, [], tags, subs);
  }
}

function esc(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function emitRow(r) {
  const sec = JSON.stringify(r.secondaryMuscles);
  const tags = JSON.stringify(r.tags);
  const subs = JSON.stringify(r.substitutions);
  const eq = JSON.stringify(r.equipment);
  return `  E('${esc(r.id)}', '${esc(r.name)}', '${esc(r.primaryMuscle)}', '${esc(r.movementPattern)}', ${eq}, ${sec}, ${tags}, ${subs}),`;
}

const header = `/**\n * Extended exercise library (merged in exerciseLibrary.js).\n * Generated by scripts/generate-exercise-library-extended.mjs\n */\nconst E = (id, name, primaryMuscle, movementPattern, equipment, secondaryMuscles = [], tags = [], substitutions = []) => ({\n  id,\n  name,\n  primaryMuscle,\n  secondaryMuscles,\n  movementPattern,\n  equipment,\n  tags,\n  substitutions,\n});\n\nexport const EXTENDED_EXERCISES = [\n`;

const footer = `\n];\n`;

fs.writeFileSync(outPath, `${header}${rows.map(emitRow).join('\n')}${footer}`);
console.log('Wrote', outPath, 'exercises:', rows.length);
