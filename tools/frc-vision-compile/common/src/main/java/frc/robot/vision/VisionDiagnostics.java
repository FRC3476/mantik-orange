package frc.robot.vision;

/** Cached vision status. Diagnostic getters must read this, not the camera queue. */
public final class VisionDiagnostics {
  public boolean connected = true;
  public Double lastTimestampSeconds = null;
  public Double ageSeconds = null;
  public boolean currentValid = false;
  public String solveLabel = "";
  public int tagsUsed = 0;
  public String lastRejectReason = "";
  public int acceptedCount = 0;
  public int rejectedCount = 0;
}
