import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const TriggerUpdate = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to the listing with update parameter
    navigate("/listing/57cd2671-3ec9-4e81-b5a6-2b97b373041a?update=chipfoundry");
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 flex items-center justify-center">
      <p className="text-muted-foreground">Updating ChipFoundry listing...</p>
    </div>
  );
};

export default TriggerUpdate;
