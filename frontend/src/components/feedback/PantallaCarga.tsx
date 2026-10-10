import { Spinner, Text, makeStyles, tokens } from "@fluentui/react-components";

const useEstilos = makeStyles({
  raiz: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    backgroundColor: tokens.colorNeutralBackground2,
  },
  logo: {
    width: "72px",
    height: "auto",
  },
});

export function PantallaCarga({ mensaje = "Cargando…" }: { mensaje?: string }) {
  const estilos = useEstilos();
  return (
    <div className={estilos.raiz} role="status" aria-live="polite">
      <img src="/logo-ficct.png" alt="" className={estilos.logo} />
      <Spinner size="tiny" />
      <Text size={200}>{mensaje}</Text>
    </div>
  );
}
