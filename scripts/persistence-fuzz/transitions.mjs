// Test-only transition projection. Audio positions and ordinary countdowns are deliberately absent.
const select = (value, keys) => Object.fromEntries(keys.filter((key) => value && Object.hasOwn(value, key)).map((key) => [key, value[key]]));
const music = (value) => (value ? [value.id, value.playback?.transport] : null);
const sounds = (values) =>
    (values ?? []).map((sound) => [sound.id, sound.playback?.activeVoiceIndex, sound.playback?.voices?.map((voice) => [voice.looped, voice.playbackRate])]);
export function captureContext(s) {
    const segment = s.stage?.currentSegmentIndex;
    return {
        stage: s.mainFields.stageIndex,
        world: 0,
        hard: s.mainFields.difficulty === 1,
        mode: s.mode,
        segment,
        region: segment == null ? null : s.stage?.segments[segment]?.regionIndex
    };
}
export function transitionProjection(s) {
    const stage = s.stage,
        player = s.things.find((t) => t.id === stage?.simon)?.fields,
        audio = s.audio;
    return {
        context: captureContext(s),
        main: select(s.mainFields, [
            "fadeState",
            "fadeReason",
            "score",
            "players",
            "hearts",
            "playerPower",
            "enemyPower",
            "beatStageFlag",
            "floorBreaking",
            "killAllFlag"
        ]),
        frozen: (s.mainFields.timeFrozen ?? 0) > 0,
        player: select(player, ["hurt", "onStairs", "supported"]),
        dead: (player?.dead ?? 0) > 0,
        roots: stage
            ? {
                  simon: stage.simon,
                  door: stage.door,
                  checkpoint: stage.checkpoint,
                  region: stage.regionThingStack,
                  weapons: stage.weaponsStack,
                  old: stage.oldThingStack
              }
            : null,
        things: s.things.map((t) => [t.id, t.type, select(t.fields, ["state", "active", "kill", "onStairs", "supported"])]),
        requested: audio.requestedSong,
        current: audio.currentSong,
        music: music(audio.currentMusic),
        songs: audio.songs.map((song) => [song.id, song.playing, music(song.intro), music(song.loop)]),
        sounds: sounds(audio.sounds)
    };
}
