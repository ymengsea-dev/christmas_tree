# 🎄 Grand Luxury Interactive 3D Christmas Tree

> ⚠️ **Warning: Not recommended for low-end computers** ⚠️
>
> This application uses intensive 3D graphics, particle systems, and AI processing. For optimal performance, a modern computer with dedicated graphics is recommended.

> A high-fidelity 3D Christmas Tree web application based on **React**, **Three.js (R3F)**, and **AI gesture recognition**.

This project is more than just a tree - it's an interactive gallery that carries memories. Thousands of glowing particles, brilliant fairy lights, floating polaroid photos, and 3D model ornaments come together to form a luxurious Christmas tree. Users can control the tree's form (assemble/disperse), rotate the view, and interact with photos through gestures, experiencing a cinematic visual feast.

![Project Preview](public/preview.png)
_(Note: It is recommended to upload a screenshot of your running project here)_

## ✨ Core Features

- **Ultimate Visual Experience**: Tree body composed of 7,000+ glowing particles, combined with dynamic bloom and glow effects, creating a dreamy atmosphere.
- **Memory Gallery**: Photos float on the tree in "polaroid" style, each one is an independent glowing body with double-sided rendering support. Pinch gesture to zoom and view photos in detail!
- **3D Model Ornaments**: Features 12 different 3D model ornaments including candy canes, Christmas balls, socks, cards, wreaths, and gift boxes - all randomly distributed on the tree.
- **AI Gesture Control**: No mouse needed - control the tree's form (assemble/disperse), view rotation, and photo interaction through camera-captured gestures.
- **Rich Details**: Includes dynamically flickering fairy lights (250 lights), falling snowflakes (300 particles), sparkles, and various Christmas decorations.
- **Highly Customizable**: **Supports users to easily replace with their own photos and freely adjust the number of photos and other elements.**

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

**Tree Body Photos**: Name them `1.jpg`, `2.jpg`, `3.jpg` ... up to `8.jpg` (default configuration supports 8 photos).

**Recommendation**: Use square or 4:3 aspect ratio images, file size should not be too large (recommended under 500kb per image for smooth performance).

### 2. Replace Photos

Simply copy your own photos to the `public/photos/` folder, overwriting the existing images. Please keep the file name format unchanged (`1.jpg`, `2.jpg`, etc.).

### 3. Modify Photo Count (Increase or Decrease)

If you've added more photos (e.g., increased from the default 8 to 20), you need to modify the code to tell the program to load them.

Open the file: `src/App.tsx`

Find the code around line 32:

```typescript
// --- Dynamically generate photo list (top.jpg + 1.jpg to 8.jpg) ---
const TOTAL_NUMBERED_PHOTOS = 8; // <--- Modify this number!
```

### 4. Add 3D Model Ornaments

You can add your own 3D models (GLB format) to the `public/3dmodel/` folder. The project currently includes:

- Candy cane
- 4 different Christmas balls
- Christmas sock
- Christmas card
- Christmas wreath
- 4 different gift boxes

To add more models, update the `ModelOrnaments` component in `src/App.tsx` to load and include your new models.

## 🖐️ Gesture Control Instructions

- **This project has a built-in AI gesture recognition system. Please stand in front of the camera to operate (there is a DEBUG button in the bottom right corner of the screen to view the camera feed)**:

| Gesture                     | Action      | Description                                                                   |
| --------------------------- | ----------- | ----------------------------------------------------------------------------- |
| 🖐 Open Palm                | Disperse    | The Christmas tree explodes into particles and photos flying everywhere       |
| ✊ Closed Fist              | Assemble    | All elements instantly assemble into a perfect Christmas tree                 |
| 👋 Hand Left/Right Movement | Rotate View | Hand moves left, tree rotates left; hand moves right, tree rotates right      |
| 🤏 Pinch Gesture            | Zoom Photo  | Pinch on a photo to zoom it to the center of the screen (works in CHAOS mode) |

## ⚙️ Advanced Configuration

- **If you are familiar with code, you can adjust more visual parameters in the CONFIG object in `src/App.tsx`**:

```typescript
const CONFIG = {
  colors: { ... }, // Modify tree, lights, and border colors
  counts: {
    foliage: 7000,    // Modify foliage particle count (reducing may improve performance)
    ornaments: 52,    // Modify number of hanging photos/polaroids
    elements: 150,    // Modify number of Christmas decoration elements
    lights: 250,      // Modify number of fairy lights
    models: 40        // Modify number of 3D model ornaments
  },
  tree: { height: 28, radius: 9 }, // Modify tree size
  // ...
};
```

**Performance Note**: The default configuration is optimized for modern computers. If you experience performance issues, consider reducing:

- `foliage`: Lower values (3000-5000) for better FPS
- `ornaments`: Fewer photos (30-40)
- `elements`: Fewer decorations (80-100)
- `lights`: Fewer lights (150-200)
- `models`: Fewer 3D models (20-30)

## 📄 License

MIT License. Feel free to use and modify for your own holiday celebrations!

## Merry Christmas! 🎄✨
