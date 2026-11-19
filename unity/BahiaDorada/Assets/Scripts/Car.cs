using System.Collections.Generic;
using UnityEngine;

namespace BahiaDorada
{
    // Coche con física arcade sobre Rigidbody. Lo conduce el jugador, el tráfico o la policía.
    [RequireComponent(typeof(Rigidbody))]
    public class Car : MonoBehaviour
    {
        public static readonly List<Car> All = new List<Car>();
        public string modelName = "Brisa";
        public float maxSpeed = 36f, accel = 14f;
        public float throttle, steer; public bool handbrake;
        public float speed; public float health = 100f;
        public enum Driver { None, Player, Traffic, Police }
        public Driver driver = Driver.None;
        public bool isPolice; public Human driverBody;
        Rigidbody rb; readonly List<Transform> wheels = new List<Transform>(); readonly List<Transform> frontWheels = new List<Transform>();
        Renderer barRed, barBlue; Material paint; public bool wrecked;
        static readonly Color[] Paints = { new Color(0.62f, 0.1f, 0.1f), new Color(0.12f, 0.3f, 0.6f), new Color(0.92f, 0.92f, 0.9f), new Color(0.08f, 0.08f, 0.08f), new Color(0.18f, 0.42f, 0.29f), new Color(0.8f, 0.63f, 0.15f), new Color(0.72f, 0.72f, 0.74f), new Color(0.85f, 0.4f, 0.22f) };
        static readonly string[] Names = { "Brisa", "Pelícano", "Toro GT", "Monte 4x4", "Furgo" };

        Vector3 Vel
        {
#if UNITY_6000_0_OR_NEWER
            get => rb.linearVelocity; set => rb.linearVelocity = value;
#else
            get => rb.velocity; set => rb.velocity = value;
#endif
        }

        public static Car Spawn(Vector3 pos, float yaw, bool police = false, Color? color = null, int type = -1)
        {
            var go = new GameObject(police ? "Patrulla" : "Coche");
            go.transform.SetPositionAndRotation(pos + Vector3.up * 0.1f, Quaternion.Euler(0, yaw, 0));
            var rb = go.AddComponent<Rigidbody>(); rb.mass = 1200;
#if UNITY_6000_0_OR_NEWER
            rb.angularDamping = 3f;
#else
            rb.angularDrag = 3f;
#endif
            rb.interpolation = RigidbodyInterpolation.Interpolate;
            rb.constraints = RigidbodyConstraints.FreezeRotationX | RigidbodyConstraints.FreezeRotationZ; rb.centerOfMass = new Vector3(0, 0.3f, 0);
            rb.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;
            var col = go.AddComponent<BoxCollider>(); col.size = new Vector3(1.9f, 1.3f, 4.5f); col.center = new Vector3(0, 0.85f, 0);
            var car = go.AddComponent<Car>();
            if (type < 0) type = Random.Range(0, Names.Length);
            car.isPolice = police; car.modelName = police ? "Patrulla" : Names[type];
            float len = type == 4 ? 5.0f : type == 1 ? 4.0f : 4.5f, h = type == 4 ? 1.2f : type == 3 ? 0.9f : 0.7f, cabH = type == 4 ? 0.8f : 0.6f;
            car.maxSpeed = police ? 44 : type == 2 ? 46 : type == 4 ? 29 : 37; car.accel = type == 2 ? 19 : 14;
            car.paint = Mats.Color(police ? new Color(0.06f, 0.06f, 0.07f) : color ?? Paints[Random.Range(0, Paints.Length)], 0.85f, 0.45f);
            var glass = Mats.Color(new Color(0.05f, 0.07f, 0.1f), 0.95f, 0.6f);
            var tire = Mats.Color(new Color(0.07f, 0.07f, 0.07f), 0.1f);
            var rim = Mats.Color(new Color(0.75f, 0.76f, 0.78f), 0.8f, 0.9f);
            var head = Mats.Emissive(UnityEngine.Color.white, new Color(1f, 0.95f, 0.8f) * 1.2f);
            var tail = Mats.Emissive(new Color(0.5f, 0, 0), new Color(1f, 0.05f, 0.05f) * 0.8f);
            float baseY = 0.38f + (type == 3 ? 0.15f : 0);
            Piece(go.transform, PrimitiveType.Cube, new Vector3(0, baseY + h / 2, 0), new Vector3(1.86f, h, len), car.paint);
            float cabLen = type == 4 ? len * 0.78f : len * 0.48f, cabZ = type == 4 ? -0.35f : -0.25f;
            Piece(go.transform, PrimitiveType.Cube, new Vector3(0, baseY + h + cabH / 2, cabZ), new Vector3(1.66f, cabH, cabLen), glass);
            Piece(go.transform, PrimitiveType.Cube, new Vector3(0, baseY + h + cabH, cabZ), new Vector3(1.7f, 0.06f, cabLen * 0.86f), car.paint);
            Piece(go.transform, PrimitiveType.Cube, new Vector3(0, baseY + 0.12f, len / 2 + 0.03f), new Vector3(1.9f, 0.22f, 0.15f), rim);
            Piece(go.transform, PrimitiveType.Cube, new Vector3(0, baseY + 0.12f, -len / 2 - 0.03f), new Vector3(1.9f, 0.22f, 0.15f), rim);
            foreach (int s in new[] { -1, 1 })
            {
                Piece(go.transform, PrimitiveType.Cube, new Vector3(s * 0.62f, baseY + h * 0.65f, len / 2 + 0.01f), new Vector3(0.4f, 0.14f, 0.04f), head);
                Piece(go.transform, PrimitiveType.Cube, new Vector3(s * 0.62f, baseY + h * 0.65f, -len / 2 - 0.01f), new Vector3(0.36f, 0.12f, 0.04f), tail);
            }
            if (police)
            {
                Piece(go.transform, PrimitiveType.Cube, new Vector3(0, baseY + h * 0.6f, -0.2f), new Vector3(1.88f, h * 0.5f, 2.0f), Mats.Color(UnityEngine.Color.white, 0.8f, 0.3f));
                car.barRed = Piece(go.transform, PrimitiveType.Cube, new Vector3(-0.3f, baseY + h + cabH + 0.12f, cabZ), new Vector3(0.5f, 0.14f, 0.28f), Mats.Emissive(UnityEngine.Color.red, UnityEngine.Color.red * 2f)).GetComponent<Renderer>();
                car.barBlue = Piece(go.transform, PrimitiveType.Cube, new Vector3(0.3f, baseY + h + cabH + 0.12f, cabZ), new Vector3(0.5f, 0.14f, 0.28f), Mats.Emissive(UnityEngine.Color.blue, UnityEngine.Color.blue * 2f)).GetComponent<Renderer>();
            }
            foreach (int sx in new[] { -1, 1 })
                foreach (int sz in new[] { -1, 1 })
                {
                    var piv = new GameObject("Rueda").transform; piv.SetParent(go.transform, false);
                    piv.localPosition = new Vector3(sx * 0.82f, 0.36f, sz * (len / 2 - 0.85f));
                    var spin = new GameObject("Giro").transform; spin.SetParent(piv, false);
                    var t = Piece(spin, PrimitiveType.Cylinder, Vector3.zero, new Vector3(0.72f, 0.13f, 0.72f), tire); t.transform.localRotation = Quaternion.Euler(0, 0, 90);
                    var r = Piece(spin, PrimitiveType.Cylinder, new Vector3(sx * 0.02f, 0, 0), new Vector3(0.46f, 0.14f, 0.46f), rim); r.transform.localRotation = Quaternion.Euler(0, 0, 90);
                    car.wheels.Add(spin); if (sz > 0) car.frontWheels.Add(piv);
                }
            return car;
        }

        static GameObject Piece(Transform p, PrimitiveType t, Vector3 pos, Vector3 scale, Material m)
        {
            var g = GameObject.CreatePrimitive(t); Destroy(g.GetComponent<Collider>());
            g.transform.SetParent(p, false); g.transform.localPosition = pos; g.transform.localScale = scale;
            var r = g.GetComponent<Renderer>(); r.sharedMaterial = m; return g;
        }

        void Awake() { rb = GetComponent<Rigidbody>(); All.Add(this); }
        void OnDestroy() { All.Remove(this); }

        public void SeatDriver(Human h)
        {
            driverBody = h; h.transform.SetParent(transform, false);
            h.transform.localPosition = new Vector3(-0.38f, 0.05f, -0.15f); h.transform.localRotation = Quaternion.identity; h.transform.localScale = Vector3.one * 0.92f; h.Sit();
        }

        void FixedUpdate()
        {
            float dt = Time.fixedDeltaTime; Vector3 fwd = transform.forward;
            speed = Vector3.Dot(Vel, fwd);
            float thr = wrecked ? 0 : throttle;
            if (thr > 0) speed += (speed < -0.5f ? 30f : accel * (1 - Mathf.Max(0, speed) / maxSpeed * 0.75f)) * thr * dt;
            else if (thr < 0) speed += (speed > 0.5f ? -30f : -accel * 0.6f) * -thr * dt;
            else speed = Mathf.MoveTowards(speed, 0, 4f * dt);
            if (handbrake) speed = Mathf.MoveTowards(speed, 0, 18f * dt);
            speed = Mathf.Clamp(speed, -12f, wrecked ? 0 : maxSpeed);
            float ang = steer * 35f / (1f + Mathf.Abs(speed) * 0.035f) * (handbrake ? 1.5f : 1f);
            float yawRate = speed / 2.7f * Mathf.Tan(ang * Mathf.Deg2Rad) * Mathf.Rad2Deg;
            rb.MoveRotation(rb.rotation * Quaternion.Euler(0, yawRate * dt, 0));
            Vector3 v = fwd * speed; v.y = Vel.y; Vel = v;
        }

        void Update()
        {
            foreach (var w in wheels) w.Rotate(Vector3.right, speed * Time.deltaTime / 0.36f * Mathf.Rad2Deg, Space.Self);
            foreach (var f in frontWheels) f.localRotation = Quaternion.Euler(0, steer * 28f, 0);
            if (barRed)
            {
                bool on = driver == Driver.Police && Police.Level > 0, ph = Mathf.FloorToInt(Time.time * 6) % 2 == 0;
                barRed.enabled = !on || ph; barBlue.enabled = !on || !ph;
            }
        }

        void OnCollisionEnter(Collision c)
        {
            float imp = c.relativeVelocity.magnitude;
            if (imp < 7f) return;
            health -= imp * 0.8f;
            if (driver == Driver.Player) { CameraRig.Shake(Mathf.Min(1, imp / 25f)); var other = c.collider.GetComponentInParent<Car>(); if (other && other.isPolice) Police.AddWanted(1); }
            if (health <= 0 && !wrecked) { wrecked = true; paint.color = new Color(0.1f, 0.1f, 0.1f); if (driver == Driver.Player) HUD.Sub("<color=#ff6b6b>¡El motor se ha roto!</color> Sal del coche.", 4); }
        }
    }
}
