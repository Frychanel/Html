using System.Collections.Generic;
using UnityEngine;

namespace BahiaDorada
{
    // Genera la ciudad original "Bahía Dorada": cuadrícula de calles, aceras, edificios, parques y playa.
    public static class City
    {
        public const float CELL = 96f, ROAD = 16f, BLOCK = 80f, SIDE = 37f;
        public const int N = 12;
        public static float HALF => N * CELL / 2f;
        public static Transform Root;
        public static Vector3 HomeSpawn, HomeCar, Hospital, PoliceStation, Plaza;
        public static float HomeCarYaw;
        public static readonly List<Vector3> MissionSpots = new List<Vector3>();
        public static string[] BlockType = new string[N * N];
        static System.Random rnd;

        public static Vector3 Node(int i, int j) => new Vector3(-HALF + i * CELL, 0, -HALF + j * CELL);
        public static Vector3 BlockCenter(int i, int j) => new Vector3(-HALF + i * CELL + CELL / 2, 0, -HALF + j * CELL + CELL / 2);
        public static int CellIdx(float v) => Mathf.FloorToInt((v + HALF) / CELL);

        public static Vector3 PerimeterPoint(Vector3 c, float t)
        {
            float P = SIDE, L = 8 * P, s = ((t % L) + L) % L; int side = (int)(s / (2 * P)); float u = s % (2 * P) - P;
            switch (side)
            {
                case 0: return new Vector3(c.x + u, 0.3f, c.z - P);
                case 1: return new Vector3(c.x + P, 0.3f, c.z + u);
                case 2: return new Vector3(c.x - u, 0.3f, c.z + P);
                default: return new Vector3(c.x - P, 0.3f, c.z - u);
            }
        }

        public static string ZoneName(Vector3 p)
        {
            if (p.x < -584) return "Playa Coral";
            int i = CellIdx(p.x), j = CellIdx(p.z);
            float d = Mathf.Max(Mathf.Abs(i - 5.5f), Mathf.Abs(j - 5.5f));
            if (d < 1.6f) return "Centro";
            if (p.x < -200 && p.z > 100) return "Puerto Viejo";
            if (p.x < -200) return "Barrio Mangle";
            if (p.z < -200) return "Las Lomas";
            if (p.x > 200 && p.z > 0) return "Villa Palmeras";
            return "El Mercado";
        }

        static float R(float a, float b) => a + (float)rnd.NextDouble() * (b - a);

        public static GameObject Box(string name, Vector3 pos, Vector3 size, Material m, bool collider, Vector2? tile = null, Transform parent = null)
        {
            var g = GameObject.CreatePrimitive(PrimitiveType.Cube);
            g.name = name; g.transform.SetParent(parent ? parent : Root, false);
            g.transform.localPosition = pos; g.transform.localScale = size;
            var r = g.GetComponent<Renderer>(); r.sharedMaterial = m;
            if (tile.HasValue) Mats.Tile(r, tile.Value);
            if (!collider) Object.Destroy(g.GetComponent<Collider>());
            return g;
        }

        static GameObject Prim(PrimitiveType t, Vector3 pos, Vector3 scale, Material m, Transform parent, bool collider = false)
        {
            var g = GameObject.CreatePrimitive(t);
            g.transform.SetParent(parent ? parent : Root, false); g.transform.localPosition = pos; g.transform.localScale = scale;
            g.GetComponent<Renderer>().sharedMaterial = m;
            if (!collider) Object.Destroy(g.GetComponent<Collider>());
            return g;
        }

        public static void Build()
        {
            rnd = new System.Random(2005);
            Root = new GameObject("Ciudad").transform;

            // Materiales base
            var asphalt = Mats.Photo("asphalt_02", new Vector2(1, 1), UnityEngine.Color.white, 0.12f);
            var concrete = Mats.Photo("concrete_pavement", new Vector2(1, 1), UnityEngine.Color.white, 0.1f);
            var grass = Mats.Photo("leafy_grass", new Vector2(1, 1), new Color(0.85f, 0.95f, 0.8f), 0.05f);
            var sand = Mats.Photo("coast_sand_01", new Vector2(1, 1), UnityEngine.Color.white, 0.05f);
            var roof = Mats.Color(new Color(0.24f, 0.24f, 0.26f), 0.1f);
            var tiles = Mats.Photo("clay_roof_tiles", new Vector2(1, 1), UnityEngine.Color.white, 0.2f);
            var yellow = Mats.Color(new Color(0.85f, 0.7f, 0.2f), 0.4f);
            var white = Mats.Color(new Color(0.9f, 0.9f, 0.9f), 0.4f);
            var water = Mats.Color(new Color(0.08f, 0.32f, 0.5f), 0.95f, 0.2f);
            var trunk = Mats.Color(new Color(0.36f, 0.25f, 0.16f), 0.1f);
            var leaves = Mats.Color(new Color(0.22f, 0.45f, 0.18f), 0.15f);
            var lampMat = Mats.Emissive(new Color(0.9f, 0.9f, 0.85f), new Color(1f, 0.85f, 0.6f) * 0.5f);
            Mats.WindowMats.Add(lampMat);
            var pole = Mats.Color(new Color(0.18f, 0.18f, 0.2f), 0.5f, 0.6f);
            var facades = new[] {
                Mats.Facade("red_brick_03", new Color(0.75f, 0.45f, 0.38f), false, 1),
                Mats.Facade("painted_plaster_wall", new Color(0.92f, 0.85f, 0.7f), false, 2),
                Mats.Facade("painted_plaster_wall", new Color(0.92f, 0.68f, 0.7f), false, 3),
                Mats.Facade("painted_plaster_wall", new Color(0.7f, 0.86f, 0.8f), false, 4),
                Mats.Facade("painted_plaster_wall", new Color(0.95f, 0.95f, 0.92f), false, 5),
            };
            var towers = new[] { Mats.Facade(null, new Color(0.35f, 0.42f, 0.5f), true, 6), Mats.Facade(null, new Color(0.3f, 0.34f, 0.38f), true, 7) };

            // Suelo, playa y mar
            float L = N * CELL + ROAD;
            var ground = Box("Cesped", new Vector3(30, -0.05f, 0), new Vector3(1460, 0.1f, 1700), grass, true, new Vector2(1460 / 6f, 1700 / 6f));
            Box("Arena", new Vector3(-645, -0.04f, 0), new Vector3(126, 0.1f, 1700), sand, true, new Vector2(126 / 5f, 1700 / 5f));
            Box("Mar", new Vector3(-1700, -0.4f, 0), new Vector3(2000, 0.1f, 3000), water, false);
            // Límites invisibles del mundo
            foreach (var (p, s) in new[] { (new Vector3(-700, 5, 0), new Vector3(2, 20, 1500)), (new Vector3(700, 5, 0), new Vector3(2, 20, 1500)), (new Vector3(0, 5, -700), new Vector3(1500, 20, 2)), (new Vector3(0, 5, 700), new Vector3(1500, 20, 2)) })
            { var w = Box("Limite", p, s, white, true); w.GetComponent<Renderer>().enabled = false; }

            // Calles con marcas viales
            for (int k = 0; k <= N; k++)
            {
                float p = -HALF + k * CELL;
                Box("CalleH", new Vector3(0, 0.0f, p), new Vector3(L, 0.04f, ROAD), asphalt, false, new Vector2(L / 5f, ROAD / 5f));
                Box("CalleV", new Vector3(p, 0.005f, 0), new Vector3(ROAD, 0.04f, L), asphalt, false, new Vector2(ROAD / 5f, L / 5f));
                for (int t = 0; t < N; t++)
                {
                    float mid = -HALF + t * CELL + CELL / 2, seg = CELL - ROAD - 6;
                    foreach (float o in new[] { -0.2f, 0.2f })
                    {
                        Box("Linea", new Vector3(mid, 0.03f, p + o), new Vector3(seg, 0.01f, 0.15f), yellow, false);
                        Box("Linea", new Vector3(p + o, 0.03f, mid), new Vector3(0.15f, 0.01f, seg), yellow, false);
                    }
                    foreach (float o in new[] { -ROAD / 2 + 0.7f, ROAD / 2 - 0.7f })
                    {
                        Box("Borde", new Vector3(mid, 0.03f, p + o), new Vector3(seg, 0.01f, 0.15f), white, false);
                        Box("Borde", new Vector3(p + o, 0.03f, mid), new Vector3(0.15f, 0.01f, seg), white, false);
                    }
                }
            }

            // Manzanas
            var special = new Dictionary<string, string> { { "10,9", "hideout" }, { "3,6", "hospital" }, { "7,2", "police" }, { "5,6", "plaza" } };
            for (int i = 0; i < N; i++)
                for (int j = 0; j < N; j++)
                {
                    var c = BlockCenter(i, j);
                    float d = Mathf.Max(Mathf.Abs(i - 5.5f), Mathf.Abs(j - 5.5f));
                    string type = d < 1.6f ? "downtown" : d < 3.6f ? "commercial" : "residential";
                    if (type != "downtown" && rnd.NextDouble() < 0.08) type = "park";
                    if (special.TryGetValue(i + "," + j, out var sp)) type = sp;
                    BlockType[i * N + j] = type;
                    var block = new GameObject("Manzana " + i + "," + j).transform; block.SetParent(Root, false);
                    Box("Acera", c + new Vector3(0, 0.15f, 0), new Vector3(BLOCK, 0.3f, BLOCK), concrete, true, new Vector2(BLOCK / 3f, BLOCK / 3f), block);

                    switch (type)
                    {
                        case "park":
                        case "plaza":
                            Box("Jardin", c + new Vector3(0, 0.31f, 0), new Vector3(BLOCK - 8, 0.02f, BLOCK - 8), type == "plaza" ? concrete : grass, false, new Vector2(12, 12), block);
                            for (int k = 0; k < 12; k++) Tree(c + new Vector3(R(-32, 32), 0.3f, R(-32, 32)), trunk, leaves, block);
                            if (type == "plaza")
                            {
                                Plaza = c;
                                Prim(PrimitiveType.Cylinder, c + new Vector3(0, 0.8f, 0), new Vector3(16, 0.5f, 16), Mats.Color(new Color(0.85f, 0.82f, 0.74f), 0.2f), block, true);
                                Prim(PrimitiveType.Cylinder, c + new Vector3(0, 1.3f, 0), new Vector3(14.6f, 0.05f, 14.6f), water, block);
                                Prim(PrimitiveType.Cylinder, c + new Vector3(0, 3.5f, 0), new Vector3(1.6f, 2.5f, 1.6f), Mats.Color(new Color(0.85f, 0.82f, 0.74f), 0.2f), block, true);
                                Prim(PrimitiveType.Sphere, c + new Vector3(0, 6.6f, 0), new Vector3(2.4f, 2.4f, 2.4f), Mats.Color(new Color(0.8f, 0.62f, 0.15f), 0.9f, 1f), block);
                            }
                            break;
                        case "downtown":
                            {
                                float h = R(50, 130) * (1.35f - d * 0.22f), w = R(42, 56), dd = R(42, 56);
                                Building(c, w, dd, h, towers[rnd.Next(towers.Length)], roof, block);
                                if (rnd.NextDouble() < 0.6) Box("Corona", c + new Vector3(0, 0.3f + h + 5, 0), new Vector3(w * 0.6f, 10, dd * 0.6f), towers[0], true, new Vector2(w * 0.6f / 8f, 10 / 12f), block);
                                break;
                            }
                        case "commercial":
                            foreach (var (sx, sz) in new[] { (-1, -1), (1, -1), (-1, 1), (1, 1) })
                            {
                                if (rnd.NextDouble() < 0.12) continue;
                                Building(c + new Vector3(sx * 17.5f, 0, sz * 17.5f), R(22, 31), R(22, 31), R(9, 34), facades[rnd.Next(facades.Length)], roof, block);
                            }
                            break;
                        case "hospital":
                            Building(c + new Vector3(0, 0, 4), 54, 36, 20, facades[4], roof, block);
                            Hospital = c + new Vector3(0, 0.3f, -SIDE);
                            break;
                        case "police":
                            Building(c + new Vector3(0, 0, 6), 46, 30, 14, towers[1], roof, block);
                            PoliceStation = c + new Vector3(0, 0.3f, -SIDE);
                            break;
                        default: // residencial y casa de Rafa
                            foreach (var (sx, sz) in new[] { (-1, -1), (1, -1), (-1, 1), (1, 1) })
                            {
                                var hp = c + new Vector3(sx * 17 + R(-2, 2), 0, sz * 16 + R(-1, 1));
                                float w = R(12, 17), dd = R(10, 13), h = R(4, 6.8f);
                                Building(hp, w, dd, h, facades[rnd.Next(facades.Length)], roof, block, false);
                                var rf = Box("Tejado", hp + new Vector3(0, 0.3f + h + 1.2f, 0), new Vector3(w + 1.2f, 0.25f, dd * 0.62f), tiles, false, new Vector2(3, 2), block);
                                rf.transform.localRotation = Quaternion.Euler(25, 0, 0); rf.transform.localPosition += new Vector3(0, 0, -dd * 0.24f);
                                var rf2 = Box("Tejado", hp + new Vector3(0, 0.3f + h + 1.2f, dd * 0.24f), new Vector3(w + 1.2f, 0.25f, dd * 0.62f), tiles, false, new Vector2(3, 2), block);
                                rf2.transform.localRotation = Quaternion.Euler(-25, 0, 0);
                                Tree(hp + new Vector3(sx * 7, 0.3f, sz * (dd / 2 + 3)), trunk, leaves, block);
                            }
                            if (type == "hideout")
                            {
                                HomeSpawn = c + new Vector3(-17, 0.3f, -SIDE);
                                HomeCar = c + new Vector3(-6, 0, -CELL / 2 + 6.1f); HomeCarYaw = 90f;
                            }
                            break;
                    }
                }

            // Farolas
            for (int i = 0; i <= N; i++)
                for (int j = 0; j <= N; j++)
                {
                    var n = Node(i, j) + new Vector3(ROAD / 2 + 1.2f, 0.3f, ROAD / 2 + 1.2f);
                    if (n.x > HALF || n.z > HALF) continue;
                    Prim(PrimitiveType.Cylinder, n + new Vector3(0, 3.6f, 0), new Vector3(0.22f, 3.6f, 0.22f), pole, Root, true);
                    Prim(PrimitiveType.Cube, n + new Vector3(-1, 7.2f, -1), new Vector3(0.6f, 0.2f, 0.6f), lampMat, Root);
                }
            // Palmeras en la playa
            for (int k = 0; k < 60; k++) Palm(new Vector3(R(-695, -595), 0, R(-660, 660)), trunk, leaves);

            // Puntos de misión
            MissionSpots.Add(BlockCenter(2, 9) + new Vector3(6, 0.3f, -SIDE));
            MissionSpots.Add(BlockCenter(8, 10) + new Vector3(-10, 0.3f, -SIDE));
            MissionSpots.Add(BlockCenter(1, 3) + new Vector3(6, 0.3f, -SIDE));

            StaticBatchingUtility.Combine(Root.gameObject);
        }

        static void Building(Vector3 c, float w, float d, float h, Material facade, Material roof, Transform parent, bool cornice = true)
        {
            Box("Edificio", c + new Vector3(0, 0.3f + h / 2, 0), new Vector3(w, h, d), facade, true, new Vector2(Mathf.Max(w, d) / 8f, h / 12f), parent);
            if (cornice) Box("Cornisa", c + new Vector3(0, 0.3f + h + 0.2f, 0), new Vector3(w + 0.6f, 0.4f, d + 0.6f), roof, false, null, parent);
            else Box("Techo", c + new Vector3(0, 0.3f + h + 0.05f, 0), new Vector3(w + 0.2f, 0.1f, d + 0.2f), roof, false, null, parent);
            if (h > 12 && rnd.NextDouble() < 0.6)
                Box("Aire", c + new Vector3(R(-w / 4, w / 4), 0.3f + h + 1.2f, R(-d / 4, d / 4)), new Vector3(R(3, 6), 2, R(3, 6)), Mats.Color(new Color(0.55f, 0.56f, 0.58f), 0.5f, 0.6f), false, null, parent);
        }

        static void Tree(Vector3 p, Material trunk, Material leaves, Transform parent)
        {
            float s = R(0.8f, 1.3f);
            Prim(PrimitiveType.Cylinder, p + new Vector3(0, 1.5f * s, 0), new Vector3(0.45f, 1.5f, 0.45f) * s, trunk, parent, true);
            Prim(PrimitiveType.Sphere, p + new Vector3(0, 4.2f * s, 0), new Vector3(4.2f, 3.6f, 4.2f) * s, leaves, parent);
            Prim(PrimitiveType.Sphere, p + new Vector3(1, 5.2f * s, 0.6f), new Vector3(2.8f, 2.6f, 2.8f) * s, leaves, parent);
        }

        static void Palm(Vector3 p, Material trunk, Material leaves)
        {
            float s = R(0.8f, 1.2f);
            var t = Prim(PrimitiveType.Cylinder, p + new Vector3(0, 4 * s, 0), new Vector3(0.4f, 4, 0.4f) * s, trunk, Root, true);
            t.transform.localRotation = Quaternion.Euler(R(-6, 6), 0, R(-6, 6));
            for (int k = 0; k < 7; k++)
            {
                var f = Prim(PrimitiveType.Cube, p + new Vector3(0, 8 * s, 0), new Vector3(0.7f, 0.06f, 4f) * s, leaves, Root);
                f.transform.localRotation = Quaternion.Euler(25, k * 360f / 7, 0);
                f.transform.localPosition += f.transform.forward * 1.8f * s;
            }
        }
    }
}
