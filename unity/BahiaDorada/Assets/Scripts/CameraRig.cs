using UnityEngine;

namespace BahiaDorada
{
    // Cámara en tercera persona: sigue al jugador o al coche y evita atravesar edificios.
    public class CameraRig : MonoBehaviour
    {
        public static CameraRig I;
        public float yaw, pitch = 15f; float manualT = -99, shake;
        Camera cam;
        public static void Shake(float s) { if (I) I.shake = Mathf.Max(I.shake, s); }
        public static void Look(Vector2 delta) { if (!I) return; I.yaw += delta.x; I.pitch = Mathf.Clamp(I.pitch - delta.y, -8f, 60f); I.manualT = Time.time; }

        void Awake()
        {
            I = this; cam = GetComponent<Camera>();
            cam.fieldOfView = 62; cam.nearClipPlane = 0.1f; cam.farClipPlane = 900; cam.allowHDR = true;
        }

        void LateUpdate()
        {
            var pl = Player.I; if (!pl) return;
            Vector2 md = GameInput.MouseDelta; if (md.sqrMagnitude > 0) Look(md * 2.2f);
            Vector3 target; float dist;
            if (pl.car)
            {
                target = pl.car.transform.position + Vector3.up * 1.9f; dist = 9.5f;
                if (Time.time - manualT > 1.4f && Mathf.Abs(pl.car.speed) > 1f)
                {
                    float want = pl.car.speed < -2 ? pl.car.transform.eulerAngles.y + 180 : pl.car.transform.eulerAngles.y;
                    yaw = Mathf.LerpAngle(yaw, want, Time.deltaTime * 2.6f); pitch = Mathf.Lerp(pitch, 12f, Time.deltaTime * 1.5f);
                }
                cam.fieldOfView = Mathf.Lerp(cam.fieldOfView, 62 + Mathf.Abs(pl.car.speed) * 0.35f, Time.deltaTime * 3);
            }
            else
            {
                target = pl.transform.position + Vector3.up * 1.65f; dist = 5.2f;
                if (Time.time - manualT > 2.5f && GameInput.Move.sqrMagnitude > 0.04f) yaw = Mathf.LerpAngle(yaw, pl.transform.eulerAngles.y, Time.deltaTime * 1.2f);
                cam.fieldOfView = Mathf.Lerp(cam.fieldOfView, 62, Time.deltaTime * 3);
            }
            var rot = Quaternion.Euler(pitch, yaw, 0);
            Vector3 back = rot * Vector3.back;
            if (Physics.SphereCast(target, 0.3f, back, out var hit, dist, ~0, QueryTriggerInteraction.Ignore) && !hit.collider.GetComponentInParent<Car>() && !hit.collider.GetComponent<Player>())
                dist = Mathf.Max(1f, hit.distance - 0.2f);
            transform.position = target + back * dist;
            transform.rotation = rot;
            if (shake > 0) { shake -= Time.deltaTime * 1.8f; transform.position += Random.insideUnitSphere * shake * 0.5f; }
        }
    }
}
