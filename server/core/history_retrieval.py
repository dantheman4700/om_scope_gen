                "pm_hours": metadata.get("pm_hours"),
                "total_setup_cost": metadata.get("total_setup_cost"),
                "monthly_operating_cost": metadata.get("monthly_operating_cost"),
                "automation_outputs": metadata.get("automation_outputs"),
                "client_name": metadata.get("client_name"),
                "project_name": metadata.get("project_name"),
                "industry": metadata.get("industry"),
                "project_type": metadata.get("project_type"),
                "title": metadata.get("title"),
            })
        
        print(f"[INFO] History raw matches: {len(results)}")
        if results:
            preview = ", ".join(
                [
                    f"d={r.get('distance'):.3f}|sim={r.get('similarity'):.3f}|title={(r.get('title') or 'n/a')[:40]}|services={','.join((r.get('services') or [])[:3])}"
                    for r in results[:3]
                    if r.get('distance') is not None
                ]
            )
            if preview:
                print(f"[INFO] Top distances: {preview}")
        survivors = [r for r in results if (r.get('similarity') or 0) >= self.min_similarity]
        print(f"[INFO] History survivors after min_sim {self.min_similarity}: {len(survivors)}")
        block = format_reference_block(survivors if survivors else results)
        if block:
            print("[OK] Loaded reference estimates from legacy scopes")
        else:
            print("[WARN] No legacy references available")
        return block

