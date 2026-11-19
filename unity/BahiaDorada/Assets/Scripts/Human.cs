using UnityEngine;

namespace BahiaDorada
{
    // Cuerpo humano original hecho de primitivas, con animación procedural de caminar, golpear y saludar.
    public class Human : MonoBehaviour
    {
        public Transform body, legL, legR, armL, armR;
        float phase;
        public float punchT, waveT;
        static readonly Color[] Skins = { new Color(0.35f, 0.23f, 0.13f), new Color(0.55f, 0.33f, 0.14f), new Color(0.78f, 0.53f, 0.26f), new Color(0.95f, 0.76f, 0.49f), new Color(1f, 0.86f, 0.67f) };
        static readonly Color[] Tops = { new Color(0.85f, 0.25f, 0.25f), new Color(0.23f, 0.48f, 0.84f), new Color(0.95f, 0.76f, 0.3f), new Color(0.35f, 0.65f, 0.36f), new Color(0.95f, 0.95f, 0.95f), new Color(0.13f, 0.13f, 0.13f), new Color(0.56f, 0.27f, 0.68f), new Color(0.9f, 0.5f, 0.13f) };
        static readonly Color[] Bottoms = { new Color(0.17f, 0.24f, 0.31f), new Color(0.23f, 0.35f, 0.6f), new Color(0.1f, 0.1f, 0.1f), new Color(0.43f, 0.36f, 0.29f), new Color(0.5f, 0.55f, 0.55f) };

        public static Human Create(Transform parent, Color? skin = null, Color? top = null, Color? bottom = null, Color? cap = null)
        {
            var root = new GameObject("Persona").transform; root.SetParent(parent, false);
            var h = root.gameObject.AddComponent<Human>();
            var sk = Mats.Color(skin ?? Skins[Random.Range(0, Skins.Length)], 0.35f);
            var tp = Mats.Color(top ?? Tops[Random.Range(0, Tops.Length)], 0.2f);
            var bt = Mats.Color(bottom ?? Bottoms[Random.Range(0, Bottoms.Length)], 0.15f);
            var hair = Mats.Color(new Color(0.08f, 0.06f, 0.04f), 0.4f);
            var shoe = Mats.Color(new Color(0.1f, 0.1f, 0.1f), 0.3f);
            h.body = new GameObject("Cuerpo").transform; h.body.SetParent(root, false);
            Part(PrimitiveType.Cube, h.body, new Vector3(0, 1.24f, 0), new Vector3(0.44f, 0.56f, 0.25f), tp);
            Part(PrimitiveType.Cube, h.body, new Vector3(0, 0.97f, 0), new Vector3(0.38f, 0.18f, 0.23f), bt);
            Part(PrimitiveType.Sphere, h.body, new Vector3(0, 1.7f, 0), new Vector3(0.25f, 0.29f, 0.26f), sk);
            Part(PrimitiveType.Sphere, h.body, new Vector3(0, 1.79f, -0.01f), new Vector3(0.26f, 0.15f, 0.27f), hair);
            if (cap.HasValue) Part(PrimitiveType.Cube, h.body, new Vector3(0, 1.84f, 0.06f), new Vector3(0.28f, 0.06f, 0.34f), Mats.Color(cap.Value, 0.2f));
            Part(PrimitiveType.Cube, h.body, new Vector3(-0.05f, 1.73f, 0.125f), new Vector3(0.035f, 0.025f, 0.01f), shoe);
            Part(PrimitiveType.Cube, h.body, new Vector3(0.05f, 1.73f, 0.125f), new Vector3(0.035f, 0.025f, 0.01f), shoe);
            h.legL = Limb(h.body, new Vector3(-0.1f, 0.92f, 0), 0.17f, 0.88f, bt, shoe);
            h.legR = Limb(h.body, new Vector3(0.1f, 0.92f, 0), 0.17f, 0.88f, bt, shoe);
            h.armL = Limb(h.body, new Vector3(-0.29f, 1.47f, 0), 0.12f, 0.66f, tp, sk);
            h.armR = Limb(h.body, new Vector3(0.29f, 1.47f, 0), 0.12f, 0.66f, tp, sk);
            return h;
        }

        static GameObject Part(PrimitiveType t, Transform p, Vector3 pos, Vector3 scale, Material m)
        {
            var g = GameObject.CreatePrimitive(t); Destroy(g.GetComponent<Collider>());
            g.transform.SetParent(p, false); g.transform.localPosition = pos; g.transform.localScale = scale;
            g.GetComponent<Renderer>().sharedMaterial = m; return g;
        }
        static Transform Limb(Transform p, Vector3 pivot, float w, float len, Material upper, Material end)
        {
            var piv = new GameObject("Pivote").transform; piv.SetParent(p, false); piv.localPosition = pivot;
            Part(PrimitiveType.Cube, piv, new Vector3(0, -len * 0.45f, 0), new Vector3(w, len * 0.9f, w * 1.1f), upper);
            Part(PrimitiveType.Cube, piv, new Vector3(0, -len * 0.95f, 0.04f), new Vector3(w * 1.05f, len * 0.12f, w * 1.6f), end);
            return piv;
        }

        // speed en m/s; 0 = quieto (respiración).
        public void Animate(float speed, float dt)
        {
            if (speed > 0.1f)
            {
                phase += speed * dt * 2.5f;
                float amt = Mathf.Clamp01(speed / 5f) * 45f + 10f, s = Mathf.Sin(phase) * amt;
                legL.localRotation = Quaternion.Euler(s, 0, 0); legR.localRotation = Quaternion.Euler(-s, 0, 0);
                armL.localRotation = Quaternion.Euler(-s * 0.8f, 0, 0); armR.localRotation = Quaternion.Euler(s * 0.8f, 0, 0);
                body.localPosition = new Vector3(0, Mathf.Abs(Mathf.Cos(phase)) * 0.04f, 0);
            }
            else
            {
                phase += dt;
                float b = Mathf.Sin(phase * 1.4f) * 2f;
                legL.localRotation = legR.localRotation = Quaternion.identity;
                armL.localRotation = Quaternion.Euler(b, 0, -4); armR.localRotation = Quaternion.Euler(-b, 0, 4);
                body.localPosition = Vector3.zero;
            }
            if (punchT > 0) { punchT -= dt; armR.localRotation = Quaternion.Euler(-90f * Mathf.Sin((1 - punchT / 0.35f) * Mathf.PI), 0, 0); }
            if (waveT > 0) { waveT -= dt; armR.localRotation = Quaternion.Euler(-160, 0, 20 + Mathf.Sin(Time.time * 12) * 20); }
        }

        public void Sit() { legL.localRotation = legR.localRotation = Quaternion.Euler(-80, 0, 0); armL.localRotation = armR.localRotation = Quaternion.Euler(-30, 0, 0); }
    }
}
