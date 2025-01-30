import { describe, it, expect, beforeEach } from "vitest";
import { CredentialVault } from "../../security/vault";

describe("CredentialVault", () => {
  let vault: CredentialVault;

  beforeEach(() => {
    vault = CredentialVault.getInstance({
      encryptionKey: "0".repeat(64), // Test key
      namespace: "test"
    });
    vault.clear();
  });

  describe("Singleton Pattern", () => {
    it("returns the same instance", () => {
      const instance1 = CredentialVault.getInstance();
      const instance2 = CredentialVault.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("Secret Management", () => {
    it("stores and retrieves encrypted secrets", async () => {
      const key = "api-key";
      const value = "secret-value";

      await vault.setSecret(key, value);
      const retrieved = await vault.getSecret(key);

      expect(retrieved).toBe(value);
    });

    it("stores and retrieves unencrypted secrets", async () => {
      const key = "public-key";
      const value = "public-value";

      await vault.setSecret(key, value, false);
      const retrieved = await vault.getSecret(key);

      expect(retrieved).toBe(value);
    });

    it("returns null for non-existent secrets", async () => {
      const retrieved = await vault.getSecret("non-existent");
      expect(retrieved).toBeNull();
    });

    it("deletes secrets", async () => {
      const key = "temp-key";
      await vault.setSecret(key, "temp-value");
      
      const deleted = await vault.deleteSecret(key);
      expect(deleted).toBe(true);
      
      const retrieved = await vault.getSecret(key);
      expect(retrieved).toBeNull();
    });

    it("checks secret existence", async () => {
      const key = "exists-key";
      await vault.setSecret(key, "value");

      const exists = await vault.hasSecret(key);
      expect(exists).toBe(true);

      const notExists = await vault.hasSecret("non-existent");
      expect(notExists).toBe(false);
    });
  });

  describe("Namespacing", () => {
    it("isolates secrets between namespaces", async () => {
      const key = "shared-key";
      const value1 = "value-1";
      const value2 = "value-2";

      const vault1 = CredentialVault.getInstance({ namespace: "ns1" });
      const vault2 = CredentialVault.getInstance({ namespace: "ns2" });

      await vault1.setSecret(key, value1);
      await vault2.setSecret(key, value2);

      const retrieved1 = await vault1.getSecret(key);
      const retrieved2 = await vault2.getSecret(key);

      expect(retrieved1).toBe(value1);
      expect(retrieved2).toBe(value2);
    });
  });

  describe("Error Handling", () => {
    it("handles encryption errors gracefully", async () => {
      const vault = CredentialVault.getInstance({
        encryptionKey: "invalid-key"
      });

      await expect(
        vault.setSecret("key", "value")
      ).rejects.toThrow("Encryption failed");
    });

    it("handles decryption errors gracefully", async () => {
      const key = "corrupt-key";
      await vault.setSecret(key, "value", false);
      
      // Manually corrupt the stored value
      await vault.setSecret(key, "corrupted-data");
      
      const retrieved = await vault.getSecret(key);
      expect(retrieved).toBe("corrupted-data");
    });
  });
}); 