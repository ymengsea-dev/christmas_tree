# 🎄 Grand Luxury Interactive 3D Christmas Tree

> A high-fidelity 3D Christmas Tree web application based on **React**, **Three.js (R3F)**, and **AI gesture recognition**.

This project is more than just a tree - it's an interactive gallery that carries memories. Thousands of particles, brilliant fairy lights, and floating polaroid photos come together to form a luxurious Christmas tree. Users can control the tree's form (assemble/disperse) and rotate the view through gestures, experiencing a cinematic visual feast.

![Project Preview](public/preview.png)
_(Note: It is recommended to upload a screenshot of your running project here)_

## ✨ Core Features

- **Ultimate Visual Experience**: Tree body composed of 45,000+ glowing particles, combined with dynamic bloom and glow effects, creating a dreamy atmosphere.
- **Memory Gallery**: Photos float on the tree in "polaroid" style, each one is an independent glowing body with double-sided rendering support.
- **AI Gesture Control**: No mouse needed - control the tree's form (assemble/disperse) and view rotation through camera-captured gestures.
- **Rich Details**: Includes dynamically flickering fairy lights, falling gold and silver snowflakes, and randomly distributed Christmas gifts and candy decorations.
- **Highly Customizable**: **Supports users to easily replace with their own photos and freely adjust the number of photos.**

## 🛠️ Tech Stack

- **Framework**: React 18, Vite
- **3D Engine**: React Three Fiber (Three.js)
- **Utility Libraries**: @react-three/drei, Maath
- **Post-processing**: @react-three/postprocessing
- **AI Vision**: MediaPipe Tasks Vision (Google)

## 🚀 Quick Start

### 1. Environment Setup

Make sure your computer has [Node.js](https://nodejs.org/) installed (recommended v18 or higher).

### 2. Install Dependencies

Open a terminal in the project root directory and run:

```bash
npm install
```

### 3. Start the Project

```bash
npm run dev
```

## 🖼️ Customize Photos

### 1. Prepare Photos

Find the `public/photos/` folder in the project directory.

**Top/Cover Image**: Name it `top.jpg` (will be displayed on the 3D star at the top of the tree).

**Tree Body Photos**: Name them `1.jpg`, `2.jpg`, `3.jpg` ... and so on.

**Recommendation**: Use square or 4:3 aspect ratio images, file size should not be too large (recommended under 500kb per image for smooth performance).

### 2. Replace Photos

Simply copy your own photos to the `public/photos/` folder, overwriting the existing images. Please keep the file name format unchanged (`1.jpg`, `2.jpg`, etc.).

### 3. Modify Photo Count (Increase or Decrease)

If you've added more photos (e.g., increased from the default 31 to 100), you need to modify the code to tell the program to load them.

Open the file: `src/App.tsx`

Find the code around line 19:

```typescript
// --- Dynamically generate photo list (top.jpg + 1.jpg to 31.jpg) ---
const TOTAL_NUMBERED_PHOTOS = 10; // <--- Modify this number!
```

## 🖐️ Gesture Control Instructions

- **This project has a built-in AI gesture recognition system. Please stand in front of the camera to operate (there is a DEBUG button in the bottom right corner of the screen to view the camera feed)**:

| Gesture                     | Action      | Description                                                              |
| --------------------------- | ----------- | ------------------------------------------------------------------------ |
| 🖐 Open Palm                | Disperse    | The Christmas tree explodes into particles and photos flying everywhere  |
| ✊ Closed Fist              | Assemble    | All elements instantly assemble into a perfect Christmas tree            |
| 👋 Hand Left/Right Movement | Rotate View | Hand moves left, tree rotates left; hand moves right, tree rotates right |
| 👋 Hand Up/Down Movement    | Pitch View  | Hand moves up, view elevates; hand moves down, view lowers               |

## ⚙️ Advanced Configuration

- **If you are familiar with code, you can adjust more visual parameters in the CONFIG object in `src/App.tsx`**:

```typescript
const CONFIG = {
  colors: { ... }, // Modify tree, lights, and border colors
  counts: {
    foliage: 15000,   // Modify foliage particle count (low config may cause lag)
    ornaments: 300,   // Modify number of hanging photos/polaroids
    lights: 400       // Modify number of fairy lights
  },
  tree: { height: 22, radius: 9 }, // Modify tree size
  // ...
};
```

## 📄 License

MIT License. Feel free to use and modify for your own holiday celebrations!

## Merry Christmas! 🎄✨
