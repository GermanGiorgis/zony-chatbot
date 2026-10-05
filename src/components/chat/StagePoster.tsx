/**
 * Still frame of the default Zony, rendered from the real 3D scene, so the first paint (and any device without WebGL)
 * shows the actual robot instead of a stand-in. Two framings, like the live camera: full body in the tall desktop
 * stage, upper body in the wide strip on phones. Regenerate the four files whenever the default look changes.
 */
export function StagePoster() {
  return (
    <picture>
      <source media="(min-width: 1024px) and (prefers-color-scheme: dark)" srcSet="/zony/stage-tall-dark.webp" />
      <source media="(min-width: 1024px)" srcSet="/zony/stage-tall-light.webp" />
      <source media="(prefers-color-scheme: dark)" srcSet="/zony/stage-wide-dark.webp" />
      <img src="/zony/stage-wide-light.webp" alt="" fetchPriority="high" decoding="async" className="size-full object-cover" />
    </picture>
  );
}
