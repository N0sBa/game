# Audio Files

Place your audio files (.mp3, .wav, .ogg, etc.) in this folder.

## Usage

1. **Add your audio files** to this `public/audio/` folder
   - Example: `bgmusic.mp3`, `killsound.mp3

2. **In the game's Sound Settings**, use the relative path:
   - Background Music: `/audio/bgmusic.mp3`
   - Kill Sound: `/audio/killsound.mp3`

## Supported Formats

- MP3 (`.mp3`) - Recommended
- WAV (`.wav`)
- OGG (`.ogg`)
- Any format supported by HTML5 audio element

## Notes

- Background music will loop infinitely
- Kill sound plays when you get a kill
- Files are served from the `public/audio/` directory
- Use relative paths starting with `/audio/` in the game settings

