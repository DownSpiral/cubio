# GAN Cube Practice Website

A web application for practicing Rubik's cube notation and algorithms using a GAN Smart Cube with Bluetooth connectivity.

## Features

- **Bluetooth Cube Integration**: Connect to your GAN Smart Cube via Web Bluetooth API
- **3D Cube Visualization**: Interactive cube visualization using TwistyPlayer from the cubing.js library
- **Notation Trainer**: Learn cube notation by following move sequences with automatic error correction
- **Scrambler**: Generate valid scramble sequences (random 25 moves or WCA-style)

## Getting Started

### Prerequisites

- Node.js and npm installed
- A GAN Smart Cube with Bluetooth support
- A modern browser with Web Bluetooth API support (Chrome, Edge, or Opera)

### Installation

1. Clone or download this repository
2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to the URL shown (typically `http://localhost:3000`)

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Usage

### Connecting Your Cube

1. Click "Connect to GAN Cube"
2. Select your GAN Smart Cube from the Bluetooth device list
3. Wait for connection confirmation

### Using the Scrambler

1. Select a scramble algorithm (Random 25 Moves or WCA Style)
2. Click "Generate Scramble"
3. The scramble sequence will be displayed and applied to the visualization
4. Use this to scramble your physical cube before solving

### Using the Notation Trainer

1. First, generate a scramble sequence
2. Click "Start Trainer"
3. The cube visualization resets to solved state
4. Follow the displayed move sequence on your physical cube
5. The trainer tracks your progress:
   - **Gray**: Pending moves
   - **Blue (pulsing)**: Current move to execute
   - **Green**: Completed moves
   - **Red**: Incorrect moves (automatically corrected with inverse)

6. If you make an incorrect move, the trainer automatically inserts the inverse move to correct the cube state
7. Complete the sequence to finish the trainer

## Technical Details

### Project Structure

```
cube-practice-js/
├── src/
│   ├── cube/
│   │   ├── cubeState.js       # Cube state representation
│   │   └── cubeNotation.js    # Move parsing and application
│   ├── bluetooth/
│   │   └── ganConnection.js    # GAN cube Bluetooth integration
│   ├── trainer/
│   │   └── notationTrainer.js  # Sequence tracking and error correction
│   ├── utils/
│   │   └── scrambler.js        # Scramble generation
│   └── main.js                 # Main application coordinator
├── index.html
└── package.json
```

### Dependencies

- **gan-web-bluetooth**: Library for GAN cube Bluetooth communication
- **cubing**: Cube visualization and solving library (TwistyPlayer)
- **rxjs**: Observable handling (used by gan-web-bluetooth)
- **vite**: Build tool and development server

## Browser Compatibility

Web Bluetooth API is required and is currently supported in:
- Chrome/Chromium (desktop and Android)
- Edge (Chromium-based)
- Opera

Firefox and Safari do not currently support Web Bluetooth API.

## Notes

- The cube visualization uses TwistyPlayer with setup algorithm `x2 y2` (yellow face up, green face front)
- You can adjust camera angles using the settings panel
- The trainer automatically corrects incorrect moves by inserting inverse moves
- Scramble sequences follow WCA standards (no consecutive moves on same face)
- Slice moves (M, E, S) automatically rotate the camera to show the relevant face

## License

MIT

