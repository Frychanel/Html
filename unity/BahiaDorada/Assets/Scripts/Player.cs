using UnityEngine;

namespace BahiaDorada
{
    // Rafa, el protagonista: camina, corre, salta, golpea, habla y conduce.
    [RequireComponent(typeof(CharacterController))]
    public class Player : MonoBehaviour
    {
        public static Player I;
        public Car car; public Human body;
        public float health = 100f, money = 250f;
        CharacterController cc; float vy; float knock;
        public Vector3 Pos => car ? car.transform.position : transform.position;
        public float Yaw => car ? car.transform.eulerAngles.y : transform.eulerAngles.y;

        public static Player Create(Vector3 pos, float yaw)
        {
            var go = new GameObject("Rafa"); go.transform.SetPositionAndRotation(pos, Quaternion.Euler(0, yaw, 0));
            var cc = go.AddComponent<CharacterController>(); cc.height = 1.8f; cc.radius = 0.35f; cc.center = new Vector3(0, 0.92f, 0); cc.stepOffset = 0.45f;
            var p = go.AddComponent<Player>();
            p.body = Human.Create(go.transform, new Color(0.55f, 0.33f, 0.14f), new Color(0.96f, 0.96f, 0.94f), new Color(0.23f, 0.35f, 0.6f), new Color(0.12f, 0.43f, 0.16f));
            return p;
        }

        void Awake() { I = this; cc = GetComponent<CharacterController>(); money = PlayerPrefs.GetFloat("money", 250); }

        void Update()
        {
            float dt = Time.deltaTime;
            if (GameInput.EnterDown) ToggleCar();
            if (car) { DriveUpdate(); return; }

            Vector2 mv = GameInput.Move;
            float camYaw = CameraRig.I ? CameraRig.I.yaw : 0f;
            Vector3 f = Quaternion.Euler(0, camYaw, 0) * Vector3.forward, r = Quaternion.Euler(0, camYaw, 0) * Vector3.right;
            Vector3 dir = f * mv.y + r * mv.x; float spd = 0;
            if (knock > 0) knock -= dt;
            else if (dir.sqrMagnitude > 0.01f && !Peds.Talking)
            {
                spd = (GameInput.Sprint ? 8.5f : 4.2f) * Mathf.Min(1, dir.magnitude);
                transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(dir), dt * 12f);
            }
            if (cc.isGrounded) { vy = -1f; if (GameInput.Jump && !Peds.Talking) vy = 6.5f; } else vy -= 20f * dt;
            Vector3 move = transform.forward * spd; move.y = vy;
            cc.Move(move * dt);
            body.Animate(cc.isGrounded ? spd : 0.5f, dt);

            if (GameInput.PunchDown) Punch();
            if (GameInput.TalkDown) Peds.TryTalk(this);
            HUD.Prompt(PromptText());
        }

        string PromptText()
        {
            var c = NearestCar(4.5f);
            if (c) return (Application.isMobilePlatform ? "🚗" : "F") + " — subir al " + c.modelName + (c.driver != Car.Driver.None ? " <color=#ff6b6b>(robar)</color>" : "");
            var p = Peds.Nearest(transform.position, 3f);
            if (p != null) return (Application.isMobilePlatform ? "💬" : "E") + " — hablar con " + p.name;
            return "";
        }

        void Punch()
        {
            body.punchT = 0.35f;
            var p = Peds.Nearest(transform.position + transform.forward * 0.8f, 1.4f);
            if (p != null) { transform.rotation = Quaternion.LookRotation(Flat(p.pos - transform.position)); Peds.Hit(p, transform.forward); }
        }

        static Vector3 Flat(Vector3 v) { v.y = 0; return v.sqrMagnitude < 1e-4f ? Vector3.forward : v; }

        Car NearestCar(float r)
        {
            Car best = null; float bd = r;
            foreach (var c in Car.All) { float d = Vector3.Distance(c.transform.position, transform.position); if (d < bd && !c.wrecked) { bd = d; best = c; } }
            return best;
        }

        void ToggleCar()
        {
            if (car)
            {
                if (Mathf.Abs(car.speed) > 8f) return;
                var exit = car.transform.position - car.transform.right * 2.3f + Vector3.up * 0.5f;
                car.driver = Car.Driver.None; car.throttle = 0; car.steer = 0; car.handbrake = true;
                car = null; cc.enabled = false; transform.position = exit; cc.enabled = true;
                body.gameObject.SetActive(true); HUD.InCar(false);
                return;
            }
            var c = NearestCar(4.5f); if (!c) return;
            if (c.driver != Car.Driver.None)
            {
                Police.AddWanted(c.isPolice ? 2 : 1);
                if (c.driverBody) Peds.Eject(c);
                var ai = c.GetComponent<TrafficAI>(); if (ai) Destroy(ai);
                var pa = c.GetComponent<PoliceAI>(); if (pa) Destroy(pa);
            }
            car = c; c.driver = Car.Driver.Player; c.handbrake = false;
            body.gameObject.SetActive(false); HUD.InCar(true); HUD.Vehicle(c.modelName);
        }

        void DriveUpdate()
        {
            car.throttle = GameInput.Throttle; car.steer = GameInput.Steer; car.handbrake = GameInput.Handbrake;
            cc.enabled = false; transform.position = car.transform.position; cc.enabled = true;
            Peds.CheckCarHits(car);
            HUD.Prompt("");
        }

        public void Hurt(float amount, Vector3 from)
        {
            health -= amount; knock = 0.8f; CameraRig.Shake(0.4f);
            if (health <= 0) GameBootstrap.I.KnockOut(false);
        }

        public void Respawn(Vector3 p)
        {
            if (car) { car.driver = Car.Driver.None; car = null; body.gameObject.SetActive(true); HUD.InCar(false); }
            cc.enabled = false; transform.position = p; cc.enabled = true; health = 100;
        }

        public void AddMoney(float m) { money = Mathf.Max(0, money + m); PlayerPrefs.SetFloat("money", money); }
    }
}
