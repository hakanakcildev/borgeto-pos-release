import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getShiftEmployeesByBranch,
  createShiftEmployee,
  updateShiftEmployee,
  deleteShiftEmployee,
} from "@/lib/firebase/shiftEmployees";
import {
  getShiftSchedulesByBranch,
  createShiftSchedule,
  updateShiftSchedule,
  deleteShiftSchedule,
  getStoreHoursByBranch,
  upsertStoreHours,
} from "@/lib/firebase/shifts";
import {
  getShiftOptionsByBranch,
  createShiftOption,
  updateShiftOption,
  deleteShiftOption,
} from "@/lib/firebase/shiftOptions";
import type {
  ShiftEmployee,
  ShiftSchedule,
  StoreHours,
  ShiftOption,
  DayOfWeek,
} from "@/lib/firebase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Trash2,
  Save,
  X,
  Clock,
  Calendar,
  Users,
  Edit,
} from "lucide-react";
import { POSLayout } from "@/components/layouts/POSLayout";
import { customAlert, customConfirm } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/shifts")({
  component: ShiftManagement,
});

function ShiftManagement() {
  return (
    <POSLayout headerTitle="Vardiya Kontrol">
      <ShiftManagementContent />
    </POSLayout>
  );
}

const DAYS_OF_WEEK: Array<{ value: DayOfWeek; label: string }> = [
  { value: "monday", label: "Pazartesi" },
  { value: "tuesday", label: "Salı" },
  { value: "wednesday", label: "Çarşamba" },
  { value: "thursday", label: "Perşembe" },
  { value: "friday", label: "Cuma" },
  { value: "saturday", label: "Cumartesi" },
  { value: "sunday", label: "Pazar" },
];

function ShiftManagementContent() {
  const { userData, companyId, branchId } = useAuth();
  const [employees, setEmployees] = useState<ShiftEmployee[]>([]);
  const [shiftSchedules, setShiftSchedules] = useState<ShiftSchedule[]>([]);
  const [storeHours, setStoreHours] = useState<StoreHours[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "employees" | "store-hours" | "schedule" | "shift-options"
  >("schedule");
  const [shiftOptions, setShiftOptions] = useState<ShiftOption[]>([]);
  const [showShiftOptionModal, setShowShiftOptionModal] = useState(false);
  const [editingShiftOption, setEditingShiftOption] =
    useState<ShiftOption | null>(null);
  const [savingShiftOption, setSavingShiftOption] = useState(false);
  const [shiftOptionForm, setShiftOptionForm] = useState({
    name: "",
    startTime: "08:00",
    endTime: "16:00",
    color: "#3B82F6",
    isActive: true,
  });
  // Geçici vardiya state'i - her çalışan için tüm günlerin vardiya bilgileri
  const [employeeShifts, setEmployeeShifts] = useState<
    Record<
      string,
      Record<
        DayOfWeek,
        { startTime: string; endTime: string; isOffDay: boolean } | null
      >
    >
  >({});
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<ShiftEmployee | null>(
    null
  );
  const [employeeForm, setEmployeeForm] = useState({
    name: "",
    position: "",
  });
  const [showStoreHoursModal, setShowStoreHoursModal] = useState(false);
  const [, setEditingStoreHours] = useState<StoreHours | null>(null);
  const [storeHoursForm, setStoreHoursForm] = useState({
    dayOfWeek: "monday" as DayOfWeek,
    openTime: "09:00",
    closeTime: "22:00",
    isClosed: false,
  });

  useEffect(() => {
    loadData();
  }, [companyId, branchId, userData]);

  const loadData = async () => {
    const effectiveCompanyId = companyId || userData?.companyId;
    // Manager hesapları için branchId = manager'ın kendi ID'si
    const effectiveBranchId =
      branchId || userData?.assignedBranchId || userData?.id;

    if (!effectiveCompanyId || !effectiveBranchId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [employeesData, schedulesData, hoursData, optionsData] =
        await Promise.all([
          getShiftEmployeesByBranch(effectiveCompanyId, effectiveBranchId),
          getShiftSchedulesByBranch(effectiveCompanyId, effectiveBranchId),
          getStoreHoursByBranch(effectiveCompanyId, effectiveBranchId),
          getShiftOptionsByBranch(effectiveCompanyId, effectiveBranchId),
        ]);
      setEmployees(employeesData.filter((e) => e.isActive));
      setShiftSchedules(schedulesData);
      setStoreHours(hoursData);
      setShiftOptions(optionsData.filter((o) => o.isActive));
    } catch (error) {
      console.error("Error loading data:", error);
      await customAlert("Veriler yüklenirken bir hata oluştu", "Hata", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStoreHours = async () => {
    const effectiveCompanyId = companyId || userData?.companyId;
    // Manager hesapları için branchId = manager'ın kendi ID'si
    const effectiveBranchId =
      branchId || userData?.assignedBranchId || userData?.id;

    if (!effectiveCompanyId || !effectiveBranchId) {
      await customAlert("Şirket veya şube bilgisi bulunamadı", "Hata", "error");
      return;
    }

    try {
      await upsertStoreHours({
        companyId: effectiveCompanyId,
        branchId: effectiveBranchId,
        ...storeHoursForm,
      });
      setShowStoreHoursModal(false);
      loadData();
    } catch (error) {
      console.error("Error saving store hours:", error);
      await customAlert(
        "Mağaza saatleri kaydedilirken bir hata oluştu",
        "Hata",
        "error"
      );
    }
  };

  const handleEditStoreHours = (day: DayOfWeek) => {
    const existing = storeHours.find((h) => h.dayOfWeek === day);
    if (existing) {
      setEditingStoreHours(existing);
      setStoreHoursForm({
        dayOfWeek: existing.dayOfWeek,
        openTime: existing.openTime,
        closeTime: existing.closeTime,
        isClosed: existing.isClosed,
      });
    } else {
      setEditingStoreHours(null);
      setStoreHoursForm({
        dayOfWeek: day,
        openTime: "09:00",
        closeTime: "22:00",
        isClosed: false,
      });
    }
    setShowStoreHoursModal(true);
  };

  const handleSaveEmployee = async () => {
    if (!employeeForm.name.trim()) {
      await customAlert("Çalışan adı gereklidir", "Hata", "error");
      return;
    }

    const effectiveCompanyId = companyId || userData?.companyId;
    // Manager hesapları için branchId = manager'ın kendi ID'si
    const effectiveBranchId =
      branchId || userData?.assignedBranchId || userData?.id;

    if (!effectiveCompanyId || !effectiveBranchId) {
      await customAlert("Şirket veya şube bilgisi bulunamadı", "Hata", "error");
      return;
    }

    try {
      if (editingEmployee) {
        await updateShiftEmployee(editingEmployee.id!, {
          name: employeeForm.name.trim(),
          position: employeeForm.position.trim() || undefined,
          isActive: true,
        });
      } else {
        await createShiftEmployee({
          companyId: effectiveCompanyId,
          branchId: effectiveBranchId,
          name: employeeForm.name.trim(),
          position: employeeForm.position.trim() || undefined,
          isActive: true,
        });
      }
      setShowAddEmployeeModal(false);
      setEditingEmployee(null);
      setEmployeeForm({
        name: "",
        position: "",
      });
      loadData();
    } catch (error) {
      console.error("Error saving employee:", error);
      await customAlert(
        "Çalışan kaydedilirken bir hata oluştu",
        "Hata",
        "error"
      );
    }
  };

  const handleEditEmployee = (employee: ShiftEmployee) => {
    setEditingEmployee(employee);
    setEmployeeForm({
      name: employee.name,
      position: employee.position || "",
    });
    setShowAddEmployeeModal(true);
  };

  const handleDeleteEmployee = async (id: string) => {
    const confirmed = await customConfirm(
      "Bu çalışanı silmek istediğinize emin misiniz?",
      "Onay"
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteShiftEmployee(id);
      await loadData();
    } catch (error) {
      console.error("Error deleting employee:", error);
      await customAlert("Çalışan silinirken bir hata oluştu", "Hata", "error");
    }
  };

  // TODO: Bu fonksiyonlar ileride kullanılacak
  // const handleSaveShift = async (
  //   employeeId: string,
  //   dayOfWeek: DayOfWeek,
  //   startTime: string,
  //   endTime: string,
  //   isOffDay: boolean
  // ) => { ... };
  // const handleDeleteShift = async (id: string) => { ... };

  const handleSaveEmployeeShifts = async (employeeId: string) => {
    const effectiveCompanyId = companyId || userData?.companyId;
    // Manager hesapları için branchId = manager'ın kendi ID'si
    const effectiveBranchId =
      branchId || userData?.assignedBranchId || userData?.id;

    if (!effectiveCompanyId || !effectiveBranchId) {
      await customAlert("Şirket veya şube bilgisi bulunamadı", "Hata", "error");
      return;
    }

    const employee = employees.find((e) => e.id === employeeId);
    if (!employee) return;

    const shifts = employeeShifts[employeeId];
    if (!shifts) {
      await customAlert("Kaydedilecek vardiya bulunamadı", "Hata", "error");
      return;
    }

    try {
      // Sadece geçici state'te değişen günleri güncelle
      for (const day of DAYS_OF_WEEK) {
        const shiftData = shifts[day.value];
        const existingShift = shiftSchedules.find(
          (s) => s.employeeId === employeeId && s.dayOfWeek === day.value
        );

        if (shiftData) {
          // Geçici state'te vardiya var
          if (shiftData.isOffDay) {
            // İzinli gün
            if (existingShift) {
              // Mevcut vardiyayı güncelle
              await updateShiftSchedule(existingShift.id!, {
                startTime: "00:00",
                endTime: "00:00",
                isOffDay: true,
                employeeName: employee.name,
              });
            } else {
              // Yeni vardiya oluştur
              await createShiftSchedule({
                companyId: effectiveCompanyId,
                branchId: effectiveBranchId,
                employeeId,
                employeeName: employee.name,
                dayOfWeek: day.value,
                startTime: "00:00",
                endTime: "00:00",
                isOffDay: true,
              });
            }
          } else {
            // Normal vardiya
            if (existingShift) {
              // Mevcut vardiyayı güncelle
              await updateShiftSchedule(existingShift.id!, {
                startTime: shiftData.startTime,
                endTime: shiftData.endTime,
                isOffDay: false,
                employeeName: employee.name,
              });
            } else {
              // Yeni vardiya oluştur
              await createShiftSchedule({
                companyId: effectiveCompanyId,
                branchId: effectiveBranchId,
                employeeId,
                employeeName: employee.name,
                dayOfWeek: day.value,
                startTime: shiftData.startTime,
                endTime: shiftData.endTime,
                isOffDay: false,
              });
            }
          }
        } else if (existingShift) {
          // Geçici state'te null ama mevcut vardiya var - sil
          await deleteShiftSchedule(existingShift.id!);
        }
      }

      // Geçici state'i temizle
      setEmployeeShifts((prev) => {
        const newState = { ...prev };
        delete newState[employeeId];
        return newState;
      });

      await loadData();
    } catch (error) {
      console.error("Error saving employee shifts:", error);
      await customAlert(
        "Vardiyalar kaydedilirken bir hata oluştu",
        "Hata",
        "error"
      );
    }
  };

  // TODO: Bu fonksiyon ileride kullanılacak
  /*
  const handleCopyMondayToAllWeek = async (employeeId: string) => {
    const effectiveCompanyId = companyId || userData?.companyId;
    // Manager hesapları için branchId = manager'ın kendi ID'si
    const effectiveBranchId = branchId || userData?.assignedBranchId || userData?.id;

    if (!effectiveCompanyId || !effectiveBranchId) {
      await customAlert("Şirket veya şube bilgisi bulunamadı", "Hata", "error");
      return;
    }

    // Pazartesi vardiyasını bul
    const mondayShift = shiftSchedules.find(
      (s) => s.employeeId === employeeId && s.dayOfWeek === "monday"
    );

    if (!mondayShift) {
      await customAlert(
        "Pazartesi için vardiya bulunamadı. Önce Pazartesi vardiyasını ayarlayın.",
        "Uyarı",
        "warning"
      );
      return;
    }

    const employee = employees.find((e) => e.id === employeeId);
    if (!employee) return;

    try {
      // Diğer günlere kopyala (Salı'dan Pazar'a)
      const otherDays: DayOfWeek[] = [
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ];

      for (const day of otherDays) {
        const existing = shiftSchedules.find(
          (s) => s.employeeId === employeeId && s.dayOfWeek === day
        );

        if (existing) {
          await updateShiftSchedule(existing.id!, {
            startTime: mondayShift.startTime,
            endTime: mondayShift.endTime,
            isOffDay: mondayShift.isOffDay,
            employeeName: employee.name,
          });
        } else {
          await createShiftSchedule({
            companyId: effectiveCompanyId,
            branchId: effectiveBranchId,
            employeeId,
            employeeName: employee.name,
            dayOfWeek: day,
            startTime: mondayShift.startTime,
            endTime: mondayShift.endTime,
            isOffDay: mondayShift.isOffDay,
          });
        }
      }

      loadData();
    } catch (error) {
      console.error("Error copying shifts:", error);
      await customAlert(
        "Vardiyalar kopyalanırken bir hata oluştu",
        "Hata",
        "error"
      );
    }
  };
  */

  const getShiftForEmployeeAndDay = (
    employeeId: string,
    dayOfWeek: DayOfWeek
  ): ShiftSchedule | undefined => {
    return shiftSchedules.find(
      (s) => s.employeeId === employeeId && s.dayOfWeek === dayOfWeek
    );
  };

  const getStoreHoursForDay = (
    dayOfWeek: DayOfWeek
  ): StoreHours | undefined => {
    return storeHours.find((h) => h.dayOfWeek === dayOfWeek);
  };

  const handleSaveShiftOption = async () => {
    if (savingShiftOption) return; // Çift tıklamayı önle

    if (!shiftOptionForm.name.trim()) {
      await customAlert("Vardiya adı gereklidir", "Hata", "error");
      return;
    }

    const effectiveCompanyId = companyId || userData?.companyId;
    // Manager hesapları için branchId = manager'ın kendi ID'si
    const effectiveBranchId =
      branchId || userData?.assignedBranchId || userData?.id;

    if (!effectiveCompanyId) {
      await customAlert(
        "Şirket bilgisi bulunamadı. Lütfen giriş yaptığınızdan emin olun.",
        "Hata",
        "error"
      );
      return;
    }

    if (!effectiveBranchId) {
      await customAlert(
        "Şube bilgisi bulunamadı. Lütfen giriş yaptığınızdan emin olun.",
        "Hata",
        "error"
      );
      return;
    }

    try {
      setSavingShiftOption(true);
      if (editingShiftOption) {
        await updateShiftOption(editingShiftOption.id!, {
          name: shiftOptionForm.name.trim(),
          startTime: shiftOptionForm.startTime,
          endTime: shiftOptionForm.endTime,
          color: shiftOptionForm.color,
          isActive: shiftOptionForm.isActive,
        });
      } else {
        const maxOrder =
          shiftOptions.length > 0
            ? Math.max(...shiftOptions.map((o) => o.order || 0)) + 1
            : 0;
        await createShiftOption({
          companyId: effectiveCompanyId,
          branchId: effectiveBranchId,
          name: shiftOptionForm.name.trim(),
          startTime: shiftOptionForm.startTime,
          endTime: shiftOptionForm.endTime,
          color: shiftOptionForm.color,
          isActive: shiftOptionForm.isActive,
          order: maxOrder,
        });
      }
      setShowShiftOptionModal(false);
      setEditingShiftOption(null);
      setShiftOptionForm({
        name: "",
        startTime: "08:00",
        endTime: "16:00",
        color: "#3B82F6",
        isActive: true,
      });
      await loadData();
    } catch (error) {
      console.error("Error saving shift option:", error);
      await customAlert(
        "Vardiya seçeneği kaydedilirken bir hata oluştu",
        "Hata",
        "error"
      );
    } finally {
      setSavingShiftOption(false);
    }
  };

  const handleEditShiftOption = (option: ShiftOption) => {
    setEditingShiftOption(option);
    setShiftOptionForm({
      name: option.name,
      startTime: option.startTime,
      endTime: option.endTime,
      color: option.color || "#3B82F6",
      isActive: option.isActive,
    });
    setShowShiftOptionModal(true);
  };

  const handleDeleteShiftOption = async (id: string) => {
    const confirmed = await customConfirm(
      "Bu vardiya seçeneğini silmek istediğinize emin misiniz?",
      "Onay"
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteShiftOption(id);
      await loadData();
    } catch (error) {
      console.error("Error deleting shift option:", error);
      await customAlert(
        "Vardiya seçeneği silinirken bir hata oluştu",
        "Hata",
        "error"
      );
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900 p-3 lg:p-4 overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Calendar className="h-8 w-8" />
          Vardiya Kontrol
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
          Çalışan vardiyalarını ve mağaza saatlerini yönetin
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab("schedule")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "schedule"
              ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          <Calendar className="h-4 w-4 inline mr-2" />
          Haftalık Plan
        </button>
        <button
          onClick={() => setActiveTab("store-hours")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "store-hours"
              ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          <Clock className="h-4 w-4 inline mr-2" />
          Mağaza Saatleri
        </button>
        <button
          onClick={() => setActiveTab("employees")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "employees"
              ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          <Users className="h-4 w-4 inline mr-2" />
          Çalışanlar ({employees.length})
        </button>
        <button
          onClick={() => setActiveTab("shift-options")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "shift-options"
              ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          <Clock className="h-4 w-4 inline mr-2" />
          Vardiya Seçenekleri ({shiftOptions.length})
        </button>
      </div>

      {/* Schedule Tab */}
      {activeTab === "schedule" && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          {employees.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-gray-500 dark:text-gray-400">
                Henüz çalışan bulunmuyor
              </p>
              <p className="text-sm mt-2 text-gray-400 dark:text-gray-500">
                Vardiya planlaması için önce çalışan ekleyin
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-gray-300 dark:border-gray-600 rounded-lg">
              <table className="w-full border-collapse bg-white dark:bg-gray-800">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-700 border-b-2 border-gray-300 dark:border-gray-600">
                    <th className="text-left p-3 font-semibold text-gray-900 dark:text-white sticky left-0 bg-gray-100 dark:bg-gray-700 z-10 border-r border-gray-300 dark:border-gray-600 min-w-[150px]">
                      Çalışan
                    </th>
                    {DAYS_OF_WEEK.map((day, index) => (
                      <th
                        key={day.value}
                        className={`text-center p-3 font-semibold text-gray-900 dark:text-white min-w-[140px] border-r border-gray-300 dark:border-gray-600 ${
                          index === DAYS_OF_WEEK.length - 1 ? "" : ""
                        }`}
                      >
                        {day.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee, empIndex) => {
                    // const mondayShift = getShiftForEmployeeAndDay(
                    //   employee.id!,
                    //   "monday"
                    // );
                    // const hasMondayShift = !!mondayShift; // TODO: Kullanılacak
                    return (
                      <tr
                        key={employee.id}
                        className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                          empIndex % 2 === 0
                            ? "bg-white dark:bg-gray-800"
                            : "bg-gray-50/50 dark:bg-gray-800/50"
                        }`}
                      >
                        <td className="p-3 font-medium text-gray-900 dark:text-white sticky left-0 z-10 border-r border-gray-300 dark:border-gray-600 bg-inherit">
                          <div className="flex items-center justify-between">
                            <span>{employee.name}</span>
                            {employeeShifts[employee.id!] && (
                              <Button
                                onClick={() =>
                                  handleSaveEmployeeShifts(employee.id!)
                                }
                                size="sm"
                                variant="default"
                                className="ml-2 h-6 px-2 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                                title="Tüm haftalık vardiyaları kaydet"
                              >
                                <Save className="h-3 w-3 mr-1" />
                                Kaydet
                              </Button>
                            )}
                          </div>
                        </td>
                        {DAYS_OF_WEEK.map((day, dayIndex) => {
                          const shift = getShiftForEmployeeAndDay(
                            employee.id!,
                            day.value
                          );
                          const storeHoursForDay = getStoreHoursForDay(
                            day.value
                          );
                          return (
                            <ShiftCell
                              key={`${employee.id}-${day.value}`}
                              employee={employee}
                              day={day.value}
                              shift={shift}
                              storeHours={storeHoursForDay}
                              shiftOptions={shiftOptions}
                              employeeShifts={employeeShifts}
                              setEmployeeShifts={setEmployeeShifts}
                              shiftSchedules={shiftSchedules}
                              DAYS_OF_WEEK={DAYS_OF_WEEK}
                              isLastColumn={
                                dayIndex === DAYS_OF_WEEK.length - 1
                              }
                            />
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Store Hours Tab */}
      {activeTab === "store-hours" && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DAYS_OF_WEEK.map((day) => {
              const hours = getStoreHoursForDay(day.value);
              return (
                <div
                  key={day.value}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-900 dark:text-white">
                      {day.label}
                    </h3>
                    <Button
                      onClick={() => handleEditStoreHours(day.value)}
                      size="sm"
                      variant="outline"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                  {hours ? (
                    hours.isClosed ? (
                      <p className="text-sm text-red-600 dark:text-red-400">
                        Kapalı
                      </p>
                    ) : (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {hours.openTime} - {hours.closeTime}
                      </p>
                    )
                  ) : (
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      Ayarlanmamış
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Employees Tab */}
      {activeTab === "employees" && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Çalışanlar
            </h2>
            <Button
              onClick={() => {
                setEditingEmployee(null);
                setEmployeeForm({
                  name: "",
                  position: "",
                });
                setShowAddEmployeeModal(true);
              }}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Çalışan Ekle
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {employees.map((employee) => (
              <div
                key={employee.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 bg-blue-600 dark:bg-blue-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                      {employee.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {employee.name}
                      </p>
                      {employee.position && (
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {employee.position}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    onClick={() => handleEditEmployee(employee)}
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs"
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Düzenle
                  </Button>
                  <Button
                    onClick={() => handleDeleteEmployee(employee.id!)}
                    size="sm"
                    variant="destructive"
                    className="text-xs px-2"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            {employees.length === 0 && (
              <div className="col-span-full text-center py-8">
                <Users className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                <p className="text-gray-500 dark:text-gray-400">
                  Henüz çalışan bulunmuyor
                </p>
                <Button
                  onClick={() => {
                    setEditingEmployee(null);
                    setEmployeeForm({
                      name: "",
                      position: "",
                    });
                    setShowAddEmployeeModal(true);
                  }}
                  className="mt-4"
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  İlk Çalışanı Ekle
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Employee Modal */}
      {showAddEmployeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingEmployee ? "Çalışan Düzenle" : "Yeni Çalışan Ekle"}
              </h2>
              <button
                onClick={() => {
                  setShowAddEmployeeModal(false);
                  setEditingEmployee(null);
                  setEmployeeForm({
                    name: "",
                    position: "",
                  });
                }}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ad Soyad <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={employeeForm.name}
                  onChange={(e) =>
                    setEmployeeForm({ ...employeeForm, name: e.target.value })
                  }
                  placeholder="Çalışan adı"
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Pozisyon
                </label>
                <Input
                  type="text"
                  value={employeeForm.position}
                  onChange={(e) =>
                    setEmployeeForm({
                      ...employeeForm,
                      position: e.target.value,
                    })
                  }
                  placeholder="Örn: Garson, Aşçı, Kasiyer"
                  className="w-full"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button onClick={handleSaveEmployee} className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                Kaydet
              </Button>
              <Button
                onClick={() => {
                  setShowAddEmployeeModal(false);
                  setEditingEmployee(null);
                  setEmployeeForm({
                    name: "",
                    position: "",
                  });
                }}
                variant="outline"
                className="flex-1"
              >
                İptal
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Store Hours Modal */}
      {showStoreHoursModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Mağaza Saatleri -{" "}
                {
                  DAYS_OF_WEEK.find((d) => d.value === storeHoursForm.dayOfWeek)
                    ?.label
                }
              </h2>
              <button
                onClick={() => setShowStoreHoursModal(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Kapalı mı?
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={storeHoursForm.isClosed}
                    onChange={(e) =>
                      setStoreHoursForm({
                        ...storeHoursForm,
                        isClosed: e.target.checked,
                      })
                    }
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Bu gün kapalı
                  </span>
                </label>
              </div>
              {!storeHoursForm.isClosed && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Açılış Saati
                    </label>
                    <Input
                      type="time"
                      value={storeHoursForm.openTime}
                      onChange={(e) =>
                        setStoreHoursForm({
                          ...storeHoursForm,
                          openTime: e.target.value,
                        })
                      }
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Kapanış Saati
                    </label>
                    <Input
                      type="time"
                      value={storeHoursForm.closeTime}
                      onChange={(e) =>
                        setStoreHoursForm({
                          ...storeHoursForm,
                          closeTime: e.target.value,
                        })
                      }
                      className="w-full"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <Button onClick={handleSaveStoreHours} className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                Kaydet
              </Button>
              <Button
                onClick={() => setShowStoreHoursModal(false)}
                variant="outline"
                className="flex-1"
              >
                İptal
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Options Tab */}
      {activeTab === "shift-options" && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Vardiya Seçenekleri
            </h2>
            <Button
              onClick={() => {
                setEditingShiftOption(null);
                setShiftOptionForm({
                  name: "",
                  startTime: "08:00",
                  endTime: "16:00",
                  color: "#3B82F6",
                  isActive: true,
                });
                setShowShiftOptionModal(true);
              }}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Vardiya Seçeneği Ekle
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {shiftOptions.map((option) => (
              <div
                key={option.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 flex-1">
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: option.color || "#3B82F6" }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {option.name}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {option.startTime} - {option.endTime}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    onClick={() => handleEditShiftOption(option)}
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs"
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Düzenle
                  </Button>
                  <Button
                    onClick={() => handleDeleteShiftOption(option.id!)}
                    size="sm"
                    variant="destructive"
                    className="text-xs px-2"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            {shiftOptions.length === 0 && (
              <div className="col-span-full text-center py-8">
                <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                <p className="text-gray-500 dark:text-gray-400">
                  Henüz vardiya seçeneği bulunmuyor
                </p>
                <Button
                  onClick={() => {
                    setEditingShiftOption(null);
                    setShiftOptionForm({
                      name: "",
                      startTime: "08:00",
                      endTime: "16:00",
                      color: "#3B82F6",
                      isActive: true,
                    });
                    setShowShiftOptionModal(true);
                  }}
                  className="mt-4"
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  İlk Vardiya Seçeneğini Ekle
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Shift Option Modal */}
      {showShiftOptionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingShiftOption
                  ? "Vardiya Seçeneği Düzenle"
                  : "Yeni Vardiya Seçeneği Ekle"}
              </h2>
              <button
                onClick={() => {
                  setShowShiftOptionModal(false);
                  setEditingShiftOption(null);
                  setShiftOptionForm({
                    name: "",
                    startTime: "08:00",
                    endTime: "16:00",
                    color: "#3B82F6",
                    isActive: true,
                  });
                }}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Vardiya Adı <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={shiftOptionForm.name}
                  onChange={(e) =>
                    setShiftOptionForm({
                      ...shiftOptionForm,
                      name: e.target.value,
                    })
                  }
                  placeholder="Örn: Sabah Vardiyası, Akşam Vardiyası"
                  className="w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Başlangıç Saati
                  </label>
                  <Input
                    type="time"
                    value={shiftOptionForm.startTime}
                    onChange={(e) =>
                      setShiftOptionForm({
                        ...shiftOptionForm,
                        startTime: e.target.value,
                      })
                    }
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Bitiş Saati
                  </label>
                  <Input
                    type="time"
                    value={shiftOptionForm.endTime}
                    onChange={(e) =>
                      setShiftOptionForm({
                        ...shiftOptionForm,
                        endTime: e.target.value,
                      })
                    }
                    className="w-full"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Renk
                </label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={shiftOptionForm.color}
                    onChange={(e) =>
                      setShiftOptionForm({
                        ...shiftOptionForm,
                        color: e.target.value,
                      })
                    }
                    className="w-16 h-10 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={shiftOptionForm.color}
                    onChange={(e) =>
                      setShiftOptionForm({
                        ...shiftOptionForm,
                        color: e.target.value,
                      })
                    }
                    placeholder="#3B82F6"
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={shiftOptionForm.isActive}
                    onChange={(e) =>
                      setShiftOptionForm({
                        ...shiftOptionForm,
                        isActive: e.target.checked,
                      })
                    }
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Aktif
                  </span>
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                onClick={handleSaveShiftOption}
                className="flex-1"
                disabled={savingShiftOption}
              >
                {savingShiftOption ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Kaydediliyor...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Kaydet
                  </>
                )}
              </Button>
              <Button
                onClick={() => {
                  setShowShiftOptionModal(false);
                  setEditingShiftOption(null);
                  setShiftOptionForm({
                    name: "",
                    startTime: "08:00",
                    endTime: "16:00",
                    color: "#3B82F6",
                    isActive: true,
                  });
                }}
                variant="outline"
                className="flex-1"
              >
                İptal
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ShiftCellProps {
  employee: ShiftEmployee;
  day: DayOfWeek;
  shift?: ShiftSchedule;
  storeHours?: StoreHours;
  shiftOptions: ShiftOption[];
  employeeShifts: Record<
    string,
    Record<
      DayOfWeek,
      {
        startTime: string;
        endTime: string;
        isOffDay: boolean;
        optionId?: string;
      } | null
    >
  >;
  setEmployeeShifts: React.Dispatch<
    React.SetStateAction<
      Record<
        string,
        Record<
          DayOfWeek,
          {
            startTime: string;
            endTime: string;
            isOffDay: boolean;
            optionId?: string;
          } | null
        >
      >
    >
  >;
  isLastColumn?: boolean;
  shiftSchedules: ShiftSchedule[];
  DAYS_OF_WEEK: Array<{ value: DayOfWeek; label: string }>;
}

function ShiftCell({
  employee,
  day,
  shift,
  storeHours: _storeHours, // Kullanılmıyor ama prop olarak geçiliyor
  shiftOptions,
  employeeShifts,
  setEmployeeShifts,
  isLastColumn = false,
  shiftSchedules,
  DAYS_OF_WEEK,
}: ShiftCellProps & {
  shiftSchedules: ShiftSchedule[];
  DAYS_OF_WEEK: Array<{ value: DayOfWeek; label: string }>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState<string>("");

  // Geçici state'ten veya mevcut shift'ten veri al
  // Eğer geçici state'te null ise, mevcut shift'i gösterme (silindi olarak işaretlenmiş)
  const tempShiftData = employeeShifts[employee.id!]?.[day];
  const currentShiftData =
    tempShiftData !== undefined
      ? tempShiftData
      : shift
        ? {
            startTime: shift.startTime,
            endTime: shift.endTime,
            isOffDay: shift.isOffDay,
            optionId: shiftOptions.find(
              (opt) =>
                opt.startTime === shift.startTime &&
                opt.endTime === shift.endTime
            )?.id,
          }
        : null;

  useEffect(() => {
    if (currentShiftData) {
      setSelectedOptionId(currentShiftData.optionId || "");
    } else {
      setSelectedOptionId("");
    }
  }, [currentShiftData, shiftOptions]);

  const handleOptionSelect = (optionId: string) => {
    const option = shiftOptions.find((opt) => opt.id === optionId);
    if (option) {
      setSelectedOptionId(optionId);
      // Geçici state'e kaydet - önce mevcut vardiyaları yükle
      setEmployeeShifts((prev) => {
        const employeeId = employee.id!;
        let currentEmployeeShifts = prev[employeeId];

        // Eğer geçici state yoksa, mevcut vardiyalardan oluştur
        if (!currentEmployeeShifts) {
          currentEmployeeShifts = {} as Record<
            DayOfWeek,
            {
              startTime: string;
              endTime: string;
              isOffDay: boolean;
              optionId?: string;
            } | null
          >;
          // Mevcut vardiyaları geçici state'e ekle
          DAYS_OF_WEEK.forEach((d) => {
            const existingShift = shiftSchedules.find(
              (s) => s.employeeId === employeeId && s.dayOfWeek === d.value
            );
            if (existingShift) {
              currentEmployeeShifts[d.value] = {
                startTime: existingShift.startTime,
                endTime: existingShift.endTime,
                isOffDay: existingShift.isOffDay,
                optionId: shiftOptions.find(
                  (opt) =>
                    opt.startTime === existingShift.startTime &&
                    opt.endTime === existingShift.endTime
                )?.id,
              };
            }
          });
        }

        return {
          ...prev,
          [employeeId]: {
            ...currentEmployeeShifts,
            [day]: {
              startTime: option.startTime,
              endTime: option.endTime,
              isOffDay: false,
              optionId: option.id!,
            },
          },
        };
      });
      setIsEditing(false);
    }
  };

  const handleOffDayToggle = (isOffDay: boolean) => {
    setSelectedOptionId("");
    // Geçici state'e kaydet - önce mevcut vardiyaları yükle
    setEmployeeShifts((prev) => {
      const employeeId = employee.id!;
      let currentEmployeeShifts = prev[employeeId];

      // Eğer geçici state yoksa, mevcut vardiyalardan oluştur
      if (!currentEmployeeShifts) {
        currentEmployeeShifts = {} as Record<
          DayOfWeek,
          {
            startTime: string;
            endTime: string;
            isOffDay: boolean;
            optionId?: string;
          } | null
        >;
        // Mevcut vardiyaları geçici state'e ekle
        DAYS_OF_WEEK.forEach((d) => {
          const existingShift = shiftSchedules.find(
            (s) => s.employeeId === employeeId && s.dayOfWeek === d.value
          );
          if (existingShift) {
            currentEmployeeShifts[d.value] = {
              startTime: existingShift.startTime,
              endTime: existingShift.endTime,
              isOffDay: existingShift.isOffDay,
              optionId: shiftOptions.find(
                (opt) =>
                  opt.startTime === existingShift.startTime &&
                  opt.endTime === existingShift.endTime
              )?.id,
            };
          }
        });
      }

      return {
        ...prev,
        [employeeId]: {
          ...currentEmployeeShifts,
          [day]: isOffDay
            ? {
                startTime: "00:00",
                endTime: "00:00",
                isOffDay: true,
              }
            : null,
        },
      };
    });
    setIsEditing(false);
  };

  if (isEditing) {
    const isOffDay = currentShiftData?.isOffDay || false;
    return (
      <td
        className={`p-1 border-r border-gray-300 dark:border-gray-600 ${
          isLastColumn ? "" : ""
        } bg-blue-50 dark:bg-blue-900/20`}
      >
        <div className="space-y-1">
          <label className="flex items-center gap-1 text-[10px]">
            <input
              type="checkbox"
              checked={isOffDay}
              onChange={(e) => handleOffDayToggle(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 w-3 h-3"
            />
            <span className="text-gray-700 dark:text-gray-300">İzinli</span>
          </label>
          {!isOffDay && (
            <select
              value={selectedOptionId}
              onChange={(e) => {
                if (e.target.value) {
                  handleOptionSelect(e.target.value);
                } else {
                  setSelectedOptionId("");
                  // Seçimi kaldır
                  setEmployeeShifts((prev) => {
                    const employeeId = employee.id!;
                    const currentEmployeeShifts = prev[employeeId] || {};
                    return {
                      ...prev,
                      [employeeId]: {
                        ...currentEmployeeShifts,
                        [day]: null,
                      },
                    };
                  });
                }
              }}
              className="w-full text-[10px] px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Seçin</option>
              {shiftOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          )}
          <div className="flex gap-1">
            {shift && (
              <button
                onClick={() => {
                  // Geçici state'ten veya mevcut vardiyalardan oluştur
                  setEmployeeShifts((prev) => {
                    const employeeId = employee.id!;
                    let currentEmployeeShifts = prev[employeeId];

                    if (!currentEmployeeShifts) {
                      currentEmployeeShifts = {} as Record<
                        DayOfWeek,
                        {
                          startTime: string;
                          endTime: string;
                          isOffDay: boolean;
                          optionId?: string;
                        } | null
                      >;
                      DAYS_OF_WEEK.forEach((d) => {
                        const existingShift = shiftSchedules.find(
                          (s) =>
                            s.employeeId === employeeId &&
                            s.dayOfWeek === d.value
                        );
                        if (existingShift) {
                          currentEmployeeShifts[d.value] = {
                            startTime: existingShift.startTime,
                            endTime: existingShift.endTime,
                            isOffDay: existingShift.isOffDay,
                            optionId: shiftOptions.find(
                              (opt) =>
                                opt.startTime === existingShift.startTime &&
                                opt.endTime === existingShift.endTime
                            )?.id,
                          };
                        }
                      });
                    }

                    return {
                      ...prev,
                      [employeeId]: {
                        ...currentEmployeeShifts,
                        [day]: null, // Sil
                      },
                    };
                  });
                  setIsEditing(false);
                }}
                className="flex-1 text-[10px] px-1 py-0.5 border border-red-300 dark:border-red-600 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center justify-center gap-1"
              >
                <Trash2 className="h-2.5 w-2.5" />
                Sil
              </button>
            )}
            <button
              onClick={() => {
                setIsEditing(false);
              }}
              className="flex-1 text-[10px] px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center justify-center gap-1"
            >
              <X className="h-2.5 w-2.5" />
              İptal
            </button>
          </div>
        </div>
      </td>
    );
  }

  return (
    <td
      className={`p-3 text-center cursor-pointer border-r border-gray-300 dark:border-gray-600 transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20 ${
        isLastColumn ? "" : ""
      }`}
      onClick={() => setIsEditing(true)}
    >
      {(() => {
        // Eğer geçici state'te null ise (silindi), hiçbir şey gösterme
        if (tempShiftData === null) {
          return (
            <span className="text-xs text-gray-400 dark:text-gray-500 px-2 py-1 border border-dashed border-gray-300 dark:border-gray-600 rounded inline-block">
              Tıkla
            </span>
          );
        }

        const displayShift = currentShiftData;
        if (displayShift) {
          if (displayShift.isOffDay) {
            return (
              <span className="text-xs text-red-600 dark:text-red-400 font-medium px-2 py-1 bg-red-50 dark:bg-red-900/20 rounded">
                İzinli
              </span>
            );
          } else {
            const matchingOption = shiftOptions.find(
              (opt) =>
                opt.startTime === displayShift.startTime &&
                opt.endTime === displayShift.endTime
            );
            return (
              <div className="text-xs">
                <p
                  className="text-gray-900 dark:text-white font-medium px-2 py-1 rounded inline-block"
                  style={{
                    backgroundColor: matchingOption?.color
                      ? `${matchingOption.color}20`
                      : undefined,
                    borderColor: matchingOption?.color || undefined,
                    borderWidth: matchingOption?.color ? "1px" : "0",
                  }}
                >
                  {matchingOption ? (
                    <>
                      <span
                        className="inline-block w-2 h-2 rounded-full mr-1"
                        style={{ backgroundColor: matchingOption.color }}
                      />
                      {displayShift.startTime} - {displayShift.endTime}
                    </>
                  ) : (
                    `${displayShift.startTime} - ${displayShift.endTime}`
                  )}
                </p>
              </div>
            );
          }
        } else {
          return (
            <span className="text-xs text-gray-400 dark:text-gray-500 px-2 py-1 border border-dashed border-gray-300 dark:border-gray-600 rounded inline-block">
              Tıkla
            </span>
          );
        }
      })()}
    </td>
  );
}
