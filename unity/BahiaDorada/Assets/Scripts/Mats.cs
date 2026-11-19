using System.Collections.Generic;
using UnityEngine;

namespace BahiaDorada
{
    // Materiales: texturas fotográficas (Resources/Textures) y fachadas generadas con ventanas.
    public static class Mats
    {
        public static readonly List<Material> WindowMats = new List<Material>();
        static readonly Dictionary<string, Material> cache = new Dictionary<string, Material>();

        static Material Template(string name)
        {
            var t = Resources.Load<Material>(name);
            if (t != null) return new Material(t);
            var m = new Material(Shader.Find("Standard"));
            return m;
        }

        public static Material Color(Color c, float gloss = 0.3f, float metal = 0f)
        {
            string key = "c" + c + gloss + metal;
            if (cache.TryGetValue(key, out var m)) return m;
            m = Template("BaseMat");
            m.color = c; m.SetFloat("_Glossiness", gloss); m.SetFloat("_Metallic", metal);
            cache[key] = m; return m;
        }

        public static Material Emissive(Color c, Color emit)
        {
            var m = Template("BaseMatEmit");
            m.color = c; m.EnableKeyword("_EMISSION"); m.SetColor("_EmissionColor", emit);
            return m;
        }

        // Material fotográfico: color + normal. tile = repeticiones por unidad de UV.
        public static Material Photo(string baseName, Vector2 tile, Color tint, float gloss = 0.15f)
        {
            string key = baseName + tile + tint;
            if (cache.TryGetValue(key, out var m)) return m;
            var diff = Resources.Load<Texture2D>("Textures/" + baseName + "_diff");
            var nor = Resources.Load<Texture2D>("Textures/" + baseName + "_nor");
            m = Template(nor != null ? "BaseMatNormal" : "BaseMat");
            m.color = tint; m.SetFloat("_Glossiness", gloss);
            if (diff != null) { m.mainTexture = diff; m.mainTextureScale = tile; }
            if (nor != null) { m.SetTexture("_BumpMap", nor); m.EnableKeyword("_NORMALMAP"); m.SetFloat("_BumpScale", 1f); }
            cache[key] = m; return m;
        }

        // Fachada: foto de pared (ladrillo / revoco) + rejilla de 4x4 ventanas y mapa de emisión nocturno.
        // Cada repetición de la textura cubre 8 m de ancho x 12 m de alto (4 plantas).
        public static Material Facade(string wallPhoto, Color tint, bool glass, int seed)
        {
            const int S = 256;
            var rnd = new System.Random(seed);
            var col = new Color[S * S];
            var em = new Color[S * S];
            Texture2D photo = wallPhoto != null ? Resources.Load<Texture2D>("Textures/" + wallPhoto + "_diff") : null;
            bool readable = photo != null && photo.isReadable;
            for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                {
                    Color c = tint;
                    if (readable) c = photo.GetPixelBilinear(x / 64f, y / 43f) * UnityEngine.Color.Lerp(UnityEngine.Color.white, tint, 0.55f);
                    col[y * S + x] = c; em[y * S + x] = UnityEngine.Color.black;
                }
            bool[] lit = new bool[16];
            for (int i = 0; i < 16; i++) lit[i] = rnd.NextDouble() < 0.45;
            for (int r = 0; r < 4; r++)
                for (int cI = 0; cI < 4; cI++)
                {
                    int x0 = cI * 64, y0 = r * 64;
                    Color litCol = rnd.NextDouble() < 0.3 ? new Color(1f, 0.94f, 0.78f) : new Color(1f, 0.8f, 0.45f);
                    if (glass)
                    {
                        Fill(col, S, x0 + 2, y0 + 16, 60, 46, (px, py) => UnityEngine.Color.Lerp(new Color(0.24f, 0.33f, 0.43f), new Color(0.66f, 0.78f, 0.88f), py / 46f));
                        Fill(col, S, x0, y0, 64, 16, (px, py) => new Color(0.2f, 0.22f, 0.25f));
                        Fill(col, S, x0 + 31, y0 + 16, 2, 46, (px, py) => new Color(0.15f, 0.17f, 0.2f));
                        if (lit[r * 4 + cI]) Fill(em, S, x0 + 2, y0 + 16, 60, 46, (px, py) => litCol * 0.8f);
                    }
                    else
                    {
                        int wx = x0 + 13, wy = y0 + 14, ww = 38, wh = 36;
                        Fill(col, S, wx - 3, wy - 3, ww + 6, wh + 6, (px, py) => new Color(0.9f, 0.88f, 0.83f));
                        Fill(col, S, wx, wy, ww, wh, (px, py) => UnityEngine.Color.Lerp(new Color(0.13f, 0.17f, 0.22f), new Color(0.5f, 0.6f, 0.68f), py / (float)wh));
                        Fill(col, S, wx + ww / 2 - 1, wy, 2, wh, (px, py) => new Color(0.2f, 0.2f, 0.2f));
                        Fill(col, S, wx - 4, wy - 7, ww + 8, 4, (px, py) => new Color(0.82f, 0.8f, 0.76f));
                        if (lit[r * 4 + cI]) Fill(em, S, wx, wy, ww, wh, (px, py) => litCol);
                    }
                }
            var tex = new Texture2D(S, S, TextureFormat.RGBA32, true) { wrapMode = TextureWrapMode.Repeat, anisoLevel = 4 };
            tex.SetPixels(col); tex.Apply(true);
            var etex = new Texture2D(S, S, TextureFormat.RGBA32, true) { wrapMode = TextureWrapMode.Repeat };
            etex.SetPixels(em); etex.Apply(true);
            var m = Template("BaseMatEmit");
            m.mainTexture = tex; m.color = UnityEngine.Color.white;
            m.EnableKeyword("_EMISSION"); m.SetTexture("_EmissionMap", etex); m.SetColor("_EmissionColor", UnityEngine.Color.black);
            m.SetFloat("_Glossiness", glass ? 0.85f : 0.25f); m.SetFloat("_Metallic", glass ? 0.35f : 0f);
            WindowMats.Add(m);
            return m;
        }

        static void Fill(Color[] a, int S, int x, int y, int w, int h, System.Func<int, int, Color> f)
        {
            for (int j = 0; j < h; j++)
                for (int i = 0; i < w; i++)
                {
                    int px = x + i, py = y + j;
                    if (px < 0 || py < 0 || px >= S || py >= S) continue;
                    a[py * S + px] = f(i, j);
                }
        }

        public static void SetNight(float night)
        {
            var e = new Color(1f, 0.85f, 0.6f) * (night * 1.6f);
            foreach (var m in WindowMats) m.SetColor("_EmissionColor", e);
        }

        // Asigna repetición de textura a un renderer sin crear materiales nuevos.
        public static void Tile(Renderer r, Vector2 tile)
        {
            var mpb = new MaterialPropertyBlock();
            r.GetPropertyBlock(mpb);
            mpb.SetVector("_MainTex_ST", new Vector4(tile.x, tile.y, 0, 0));
            r.SetPropertyBlock(mpb);
        }
    }
}
